import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { VLCPlayer } from 'react-native-vlc-media-player';
import { createJpegCamera } from '@/printer/jpeg-camera';
import { createRtspsSource } from './source';
import type { CameraFeedProps } from './feed.types';

function JpegFeed({ profile, accessCode, onReady, onError }: CameraFeedProps) {
  const [frame, setFrame] = useState<string>();
  useEffect(() => {
    let active = true;
    let ready = false;
    const camera = createJpegCamera(uri => {
      if (!active) return;
      setFrame(uri);
      if (!ready) { ready = true; onReady(); }
    }, message => { if (active) onError(message); });
    camera.start(profile, accessCode);
    return () => { active = false; camera.stop(); };
  }, [profile, accessCode, onReady, onError]);
  return frame ? <Image source={{ uri: frame }} style={{ width: '100%', height: '100%' }} contentFit="contain" transition={0} accessibilityLabel="Printer camera frame" /> : null;
}

function RtspsFeed({ profile, accessCode, onReady, onBuffering, onError }: CameraFeedProps) {
  const source = useMemo(() => createRtspsSource(profile.host, accessCode, profile.trustSelfSigned), [profile.host, profile.trustSelfSigned, accessCode]);
  const player = useRef<VLCPlayer>(null);
  useEffect(() => () => { player.current?.stopPlayer(); }, []);
  return <VLCPlayer ref={player} source={source} style={{ width: '100%', height: '100%' }} autoplay muted resizeMode="contain" playInBackground={false} acceptInvalidCertificates={profile.trustSelfSigned} onPlaying={onReady} onBuffering={onBuffering} onStopped={() => onError('The camera stream stopped. Reconnect to try again.')} onError={() => onError('Camera playback failed. Check LAN liveview, the access code, and the selected camera transport.')} onEnd={() => onError('The camera stream ended. Reconnect to try again.')} />;
}

export function CameraFeed(props: CameraFeedProps) {
  return props.profile.cameraProtocol === 'jpeg' ? <JpegFeed {...props} /> : <RtspsFeed {...props} />;
}
