import type { PrinterProfile } from '@/printer/types';

export interface CameraFeedProps {
  profile: PrinterProfile;
  accessCode: string;
  onReady: () => void;
  onBuffering: () => void;
  onError: (message: string) => void;
}
