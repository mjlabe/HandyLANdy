import { createJpegCameraCore } from './jpeg-camera-core';
import { createNativeTlsSocket } from './tls-socket.native';

export function createJpegCamera(onFrame: (dataUri: string) => void, onError: (message: string) => void) {
  return createJpegCameraCore(createNativeTlsSocket, onFrame, onError);
}
