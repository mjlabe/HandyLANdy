import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { CameraFeed } from '@/camera/feed';
import { usePrinters } from '@/state/printers';
import { radius, spacing, useTheme } from '@/theme';
import { Label, Notice } from './ui';
import { DemoCamera } from './demo-camera';
import { IconButton } from './icon';

export function CameraPanel({ fullscreen = false }: { fullscreen?: boolean }) {
  const state = usePrinters();
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const active = focused && state.foreground && state.enabled && !state.demo && !!state.accessCode && !paused;
  const profileId = state.profile?.id;
  return <CameraAttempt key={`${profileId}-${active}-${attempt}`} state={state} active={active} paused={paused} fullscreen={fullscreen} attempt={attempt} togglePause={() => setPaused(value => !value)} retry={() => { setPaused(false); setAttempt(value => value + 1); }} />;
}

function CameraAttempt({ state, active, paused, fullscreen, attempt, togglePause, retry }: { state: ReturnType<typeof usePrinters>; active: boolean; paused: boolean; fullscreen: boolean; attempt: number; togglePause: () => void; retry: () => void }) {
  const theme = useTheme();
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<string>();
  const profileId = state.profile?.id;
  useEffect(() => {
    if (!active || ready || failure) return;
    const timer = setTimeout(() => setFailure('No camera frames arrived. Check LAN liveview, the camera transport, and whether another client is using the stream.'), 15_000);
    return () => clearTimeout(timer);
  }, [active, ready, failure, attempt, profileId]);
  const onReady = useCallback(() => setReady(true), []);
  const onBuffering = useCallback(() => setReady(false), []);
  const onError = useCallback((message: string) => { setReady(false); setFailure(message); }, []);
  return <View style={{ gap: spacing.sm, flex: fullscreen ? 1 : undefined }}>
    <View style={{ backgroundColor: theme.cameraBackground, borderRadius: fullscreen ? 0 : radius.md, borderCurve: 'continuous', overflow: 'hidden', height: fullscreen ? undefined : 220, flex: fullscreen ? 1 : undefined, minHeight: fullscreen ? 120 : undefined }}>
      {state.demo ? <DemoCamera /> : active && !failure && state.profile && state.accessCode ? <CameraFeed key={`${profileId}-${attempt}`} profile={state.profile} accessCode={state.accessCode} onReady={onReady} onBuffering={onBuffering} onError={onError} /> : null}
      {!state.demo && (!ready || !active) && <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md }}>
        {active && !failure && <ActivityIndicator color={theme.onCamera} />}
        <Label variant="label" style={{ textAlign: 'center', color: theme.onCamera }}>{failure ? 'Camera unavailable' : paused ? 'Camera paused' : active ? 'Connecting to camera…' : 'Camera is disconnected'}</Label>
        {failure && <Label variant="caption" style={{ textAlign: 'center', color: theme.onCamera }}>Printer status remains available.</Label>}
      </View>}
      <View style={{ position: 'absolute', top: spacing.sm, left: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: theme.cameraOverlay, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm }}><View style={{ width: 5, height: 5, borderRadius: radius.full, backgroundColor: ready && active ? theme.accent : theme.onCamera }} /><Label variant="caption" style={{ color: theme.onCamera }}>{state.demo ? 'DEMO' : ready && active ? 'LIVE' : paused ? 'PAUSED' : 'CAMERA'}</Label></View>
      {!fullscreen && <View style={{ position: 'absolute', top: spacing.xs, right: spacing.xs }}><IconButton name="expand" label="Fullscreen camera" testID="open-camera" inverse onPress={() => router.push('/camera')} /></View>}
      {!state.demo && <View style={{ position: 'absolute', bottom: spacing.xs, left: spacing.xs, borderRadius: radius.sm, backgroundColor: theme.cameraOverlay }}><IconButton name={failure || paused ? 'play' : 'pause'} label={failure ? 'Retry camera' : paused ? 'Start camera' : 'Pause camera'} inverse disabled={!state.enabled || !state.accessCode} onPress={failure ? retry : togglePause} /></View>}
    </View>
    {failure && <Notice error>{failure}</Notice>}
  </View>;
}
