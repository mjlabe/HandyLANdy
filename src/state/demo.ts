import type { PrinterProfile, PrinterStatus } from '@/printer/types';

export const demoProfile: PrinterProfile = {
  id: 'demo',
  name: 'Studio printer',
  host: 'Demo · no network connection',
  serial: 'DEMO',
  model: 'X1 Carbon',
  cameraProtocol: 'rtsps',
  trustSelfSigned: false,
};

export function demoStatus(now: number): PrinterStatus {
  return {
    lastReportAt: now,
    jobName: 'Stackable desk organizer',
    state: 'RUNNING',
    progress: 68,
    remainingMinutes: 47,
    layer: 204,
    totalLayers: 300,
    nozzleTemperature: 220,
    nozzleTarget: 220,
    bedTemperature: 55,
    bedTarget: 55,
    chamberTemperature: 34,
    partFan: 80,
    auxiliaryFan: 40,
    chamberFan: 30,
    ams: [
      {
        id: '0',
        humidity: 3,
        temperature: 28,
        trays: [
          { id: '0', material: 'PLA', color: '#97B998', remaining: 72 },
          { id: '1', material: 'PLA', color: '#E5D5AF', remaining: 44 },
          { id: '2', material: 'PETG', color: '#7D8996', remaining: 86 },
          { id: '3', material: 'PLA', color: '#CD8666', remaining: 35 },
        ],
      },
    ],
  };
}
