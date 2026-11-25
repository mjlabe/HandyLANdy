import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, type ColorValue } from 'react-native';
import { useTheme } from '@/theme';

const symbols = {
  printer: { ios: 'printer', android: 'print', web: 'print' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  network: { ios: 'point.3.connected.trianglepath.dotted', android: 'lan', web: 'lan' },
  profile: { ios: 'person.crop.circle', android: 'person', web: 'person' },
  expand: {
    ios: 'arrow.up.left.and.arrow.down.right',
    android: 'open_in_full',
    web: 'open_in_full',
  },
  pause: { ios: 'pause.fill', android: 'pause', web: 'pause' },
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  fan: { ios: 'fan', android: 'air', web: 'air' },
  filament: { ios: 'circle.circle', android: 'layers', web: 'layers' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
} as const satisfies Record<string, SymbolViewProps['name']>;

export type IconName = keyof typeof symbols;

export function Icon({
  name,
  size = 22,
  color,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) {
  const theme = useTheme();
  return (
    <SymbolView
      name={symbols[name]}
      tintColor={color ?? theme.text}
      size={size}
      style={{ width: size, height: size }}
    />
  );
}

export function IconButton({
  name,
  label,
  onPress,
  testID,
  inverse = false,
  disabled = false,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  testID?: string;
  inverse?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      testID={testID}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.3 : pressed ? 0.5 : 1,
      })}
    >
      <Icon name={name} color={inverse ? theme.onCamera : theme.text} />
    </Pressable>
  );
}
