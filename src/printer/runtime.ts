import processShim from 'process';

type NextTick = (callback: (...args: unknown[]) => void, ...args: unknown[]) => void;
export interface MqttRuntimeProcess { nextTick?: NextTick }

/** MQTT packet uncorking needs nextTick; React Native's process only has env. */
export function ensureMqttRuntime(runtime: MqttRuntimeProcess = globalThis.process): void {
  if (typeof runtime.nextTick !== 'function') runtime.nextTick = processShim.nextTick.bind(processShim);
}
