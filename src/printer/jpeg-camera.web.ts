import type { JpegCamera } from './jpeg-camera-core';

export function createJpegCamera(_onFrame: (dataUri: string) => void, onError: (message: string) => void): JpegCamera {
  return { start() { onError('Direct LAN camera streaming requires an iOS or Android development build.'); }, stop() {} };
}
