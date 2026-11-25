import { router, usePathname } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, useTheme } from '@/theme';
import { Icon } from './icon';
import { Label } from './ui';

const destinations = [
  { path: '/', title: 'Devices', icon: 'printer' },
  { path: '/printers', title: 'Printers', icon: 'network' },
  { path: '/settings', title: 'Me', icon: 'profile' },
] as const;

export function AppNavigation() {
  const path = usePathname();
  const theme = useTheme();
  if (!destinations.some((item) => item.path === path)) return null;
  return (
    <SafeAreaView
      edges={['bottom']}
      style={{ backgroundColor: theme.surface, borderTopWidth: 0.5, borderTopColor: theme.line }}
    >
      <View style={{ flexDirection: 'row', paddingTop: spacing.sm, paddingBottom: spacing.xs }}>
        {destinations.map((item) => {
          const selected = path === item.path;
          return (
            <Pressable
              key={item.path}
              accessibilityRole="tab"
              accessibilityLabel={item.title}
              accessibilityState={{ selected }}
              testID={`tab-${item.title.toLowerCase()}`}
              onPress={() => {
                if (!selected) router.replace(item.path);
              }}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 44,
                gap: spacing.xs,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <Icon name={item.icon} size={22} color={selected ? theme.accent : theme.muted} />
              <Label variant="caption" style={{ color: selected ? theme.accent : theme.muted }}>
                {item.title}
              </Label>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
