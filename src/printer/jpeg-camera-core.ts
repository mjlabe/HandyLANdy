import { Buffer } from 'buffer';
import { createCameraAuth, JpegFrameParser } from './jpeg-parser';
import type { TlsSocket, TlsSocketFactory } from './tls-types';
import type { PrinterProfile } from './types';

export interface JpegCamera {
  start(profile: PrinterProfile, accessCode: string): void;
  stop(): void;
}

export function createJpegCameraCore(createSocket: TlsSocketFactory, onFrame: (dataUri: string) => void, onError: (message: string) => void): JpegCamera {
  let generation = 0;
  let socket: TlsSocket | undefined;
  let parser: JpegFrameParser | undefined;
  const stop = () => {
    generation++;
    parser?.reset(); parser = undefined;
    const previous = socket; socket = undefined;
    previous?.setTimeout(0);
    previous?.removeAllListeners();
    previous?.on('error', () => {});
    previous?.destroy();
  };
  return {
    stop,
    start(profile, accessCode) {
      stop();
      const current = generation;
      const fail = (message: string) => { if (generation === current) { stop(); onError(message); } };
      if (profile.cameraProtocol !== 'jpeg') { fail('This printer profile uses an RTSPS camera.'); return; }
      try {
        const auth = createCameraAuth(accessCode);
        const active = createSocket(profile, 6000);
        socket = active;
        parser = new JpegFrameParser((frame) => { if (generation === current) onFrame(`data:image/jpeg;base64,${Buffer.from(frame).toString('base64')}`); });
        active.on('secureConnect', () => {
          if (generation !== current) return;
          try { active.write(auth, undefined, (error) => { if (error) fail('Camera authentication failed. Check the LAN access code.'); }); }
          catch { fail('Camera authentication failed. Check the LAN access code.'); }
        });
        active.on('data', (data) => {
          if (generation !== current) return;
          if (typeof data === 'string') { fail('Invalid binary camera frame.'); return; }
          try { parser?.push(data); } catch { fail('Invalid camera frame. Reconnect or check the camera protocol setting.'); }
        });
        active.on('timeout', () => fail('Camera timed out. Check LAN access, the access code, and whether another viewer is connected.'));
        active.on('error', () => fail('Camera connection failed. Check the LAN access code, network permission, and certificate trust setting.'));
        active.on('close', () => fail('Camera disconnected. Reconnect to resume the live view.'));
        active.on('end', () => fail('Camera disconnected. Reconnect to resume the live view.'));
        active.setTimeout(15000);
      } catch { fail('Camera connection failed. Check the LAN access code and native development build.'); }
    },
  };
}
