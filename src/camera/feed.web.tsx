import { useEffect } from 'react';
import type { CameraFeedProps } from './feed.types';

export function CameraFeed({ onError }: CameraFeedProps) {
  useEffect(() => { onError('Direct printer cameras require an iOS or Android development build. Use demo mode in the browser.'); }, [onError]);
  return null;
}
