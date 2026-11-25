import { CameraPanel } from '@/components/camera-panel';
import { Notice } from '@/components/ui';
import { usePrinters } from '@/state/printers';
import { spacing, useTheme } from '@/theme';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function CameraScreen() {
  const state = usePrinters();
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={{ flex: 1, backgroundColor: theme.cameraBackground }}
    >
      <StatusBar style="light" />
      <View style={{ flex: 1, padding: spacing.md, gap: spacing.md }}>
        {state.demo && <Notice>DEMO MODE · This is an illustration, not a live feed.</Notice>}
        {state.profile ? <CameraPanel fullscreen /> : <Notice>Select a printer first.</Notice>}
      </View>
    </SafeAreaView>
  );
}
