export type CameraProtocol = 'rtsps' | 'jpeg';

export interface PrinterProfile {
  id: string;
  name: string;
  host: string;
  serial: string;
  model: string;
  cameraProtocol: CameraProtocol;
  trustSelfSigned: boolean;
}

export interface FilamentTray {
  id: string;
  material?: string;
  color?: string;
  remaining?: number;
}

export interface AmsUnit {
  id: string;
  humidity?: number;
  temperature?: number;
  trays: FilamentTray[];
}

export interface PrinterStatus {
  lastReportAt?: number;
  jobName?: string;
  state?: string;
  progress?: number;
  remainingMinutes?: number;
  layer?: number;
  totalLayers?: number;
  nozzleTemperature?: number;
  nozzleTarget?: number;
  bedTemperature?: number;
  bedTarget?: number;
  chamberTemperature?: number;
  partFan?: number;
  auxiliaryFan?: number;
  chamberFan?: number;
  ams?: AmsUnit[];
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export interface SessionSnapshot {
  connection: ConnectionState;
  status: PrinterStatus;
  error?: string;
}

export interface PrinterSession {
  start(profile: PrinterProfile, accessCode: string): void;
  stop(): void;
  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void;
}
