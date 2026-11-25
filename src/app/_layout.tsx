import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, View } from 'react-native';
import { AppNavigation } from '@/components/app-navigation';
import { Label } from '@/components/ui';
import { PrinterProvider } from '@/state/printers';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const theme = useTheme();
  return (
    <PrinterProvider>
      <StatusBar style="auto" />
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            presentation: 'card',
            headerTintColor: theme.text,
            headerStyle: { backgroundColor: theme.surface },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            headerTitleStyle: { fontSize: 17, fontWeight: '600' },
            contentStyle: { backgroundColor: theme.background },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Devices', headerShown: false }} />
          <Stack.Screen name="printers" options={{ title: 'Printers' }} />
          <Stack.Screen name="profile" options={{ title: 'Add printer', presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ title: 'Me' }} />
          <Stack.Screen
            name="camera"
            options={{
              title: 'Camera',
              presentation: 'fullScreenModal',
              statusBarStyle: 'light',
              headerTintColor: theme.onCamera,
              headerStyle: { backgroundColor: theme.cameraBackground },
              headerLeft: () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close camera"
                  testID="close-camera"
                  onPress={() => router.back()}
                  hitSlop={12}
                >
                  <Label style={{ color: theme.onCamera }}>Done</Label>
                </Pressable>
              ),
            }}
          />
        </Stack>
        <AppNavigation />
      </View>
    </PrinterProvider>
  );
}
