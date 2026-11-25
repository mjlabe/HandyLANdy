import { View } from 'react-native';
import { Label } from './ui';
import { spacing, useTheme } from '@/theme';
import { PrinterArt } from './printer-art';

/** A deliberately illustrated sample, never presented as a live camera frame. */
export function DemoCamera() {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel="Illustrated sample printer, not a live camera"
      style={{
        flex: 1,
        minHeight: 190,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.cameraBackground,
        overflow: 'hidden',
      }}
    >
      <PrinterArt size={200} />
      <Label
        variant="caption"
        style={{ position: 'absolute', bottom: spacing.sm, color: theme.onCamera, opacity: 0.65 }}
      >
        Demo illustration · not a live feed
      </Label>
    </View>
  );
}
