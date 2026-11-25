import type { AmsUnit, FilamentTray, PrinterStatus } from './types';

type Dict = Record<string, unknown>;
function object(value: unknown): value is Dict { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function number(value: unknown, max = 100000): number | undefined {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : undefined;
}
function id(value: unknown): string | undefined {
  return (typeof value === 'string' || typeof value === 'number') && /^[\d]{1,3}$/.test(String(value)) ? String(value) : undefined;
}

/** Apply only recognized, valid report fields; absent values retain prior readings. */
export function normalizeReport(previous: PrinterStatus, payload: unknown, now = Date.now()): PrinterStatus | null {
  let report = payload;
  if (typeof payload === 'string') {
    if (payload.length > 1024 * 1024) return null;
    try { report = JSON.parse(payload); } catch { return null; }
  }
  if (!object(report) || !object(report.print)) return null;
  const print = report.print;
  const next: PrinterStatus = { ...previous };
  let changed = false;
  const numeric: [string, keyof PrinterStatus, number][] = [
    ['mc_percent', 'progress', 100], ['mc_remaining_time', 'remainingMinutes', 100000],
    ['layer_num', 'layer', 100000], ['total_layer_num', 'totalLayers', 100000],
    ['nozzle_temper', 'nozzleTemperature', 500], ['nozzle_target_temper', 'nozzleTarget', 500],
    ['bed_temper', 'bedTemperature', 200], ['bed_target_temper', 'bedTarget', 200],
    ['chamber_temper', 'chamberTemperature', 200],
  ];
  for (const [field, target, max] of numeric) {
    const value = number(print[field], max);
    if (value !== undefined) { Object.assign(next, { [target]: value }); changed = true; }
  }
  for (const [field, target] of [['subtask_name', 'jobName'], ['gcode_state', 'state']] as const) {
    if (typeof print[field] === 'string' && print[field].length <= 1024) { next[target] = print[field]; changed = true; }
  }
  for (const [field, target] of [['cooling_fan_speed', 'partFan'], ['big_fan1_speed', 'auxiliaryFan'], ['big_fan2_speed', 'chamberFan']] as const) {
    const value = number(print[field], 15);
    if (value !== undefined) { next[target] = Math.round(value / 15 * 100); changed = true; }
  }
  if (object(print.ams) && Array.isArray(print.ams.ams)) {
    const units: AmsUnit[] = (previous.ams ?? []).map((unit) => ({ ...unit, trays: unit.trays.map((tray) => ({ ...tray })) }));
    for (const rawUnit of print.ams.ams.slice(0, 16)) {
      if (!object(rawUnit)) continue;
      const unitId = id(rawUnit.id);
      if (unitId === undefined) continue;
      let unit = units.find((existing) => existing.id === unitId);
      if (!unit) { unit = { id: unitId, trays: [] }; units.push(unit); }
      const humidity = number(rawUnit.humidity, 100);
      const temperature = number(rawUnit.temp, 200);
      if (humidity !== undefined) { unit.humidity = humidity; changed = true; }
      if (temperature !== undefined) { unit.temperature = temperature; changed = true; }
      if (Array.isArray(rawUnit.tray)) for (const rawTray of rawUnit.tray.slice(0, 16)) {
        if (!object(rawTray)) continue;
        const trayId = id(rawTray.id);
        if (trayId === undefined) continue;
        let tray: FilamentTray | undefined = unit.trays.find((existing) => existing.id === trayId);
        if (!tray) { tray = { id: trayId }; unit.trays.push(tray); }
        if (typeof rawTray.tray_type === 'string' && rawTray.tray_type.length <= 80) { tray.material = rawTray.tray_type; changed = true; }
        if (typeof rawTray.tray_color === 'string' && /^[a-f\d]{6}([a-f\d]{2})?$/i.test(rawTray.tray_color)) { tray.color = `#${rawTray.tray_color.slice(0, 6)}`; changed = true; }
        const remaining = number(rawTray.remain, 100);
        if (remaining !== undefined) { tray.remaining = remaining; changed = true; }
      }
    }
    if (changed) next.ams = units;
  }
  return changed ? { ...next, lastReportAt: now } : null;
}
