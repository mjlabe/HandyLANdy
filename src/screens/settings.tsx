import { Column, Host, ListItem, Text as NativeText } from '@expo/ui';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Action, Label, Notice, Screen, Section } from '@/components/ui';
import { usePrinters } from '@/state/printers';
import { radius, spacing, useTheme } from '@/theme';

export default function SettingsScreen() {
  const state = usePrinters();
  const theme = useTheme();
  const [help, setHelp] = useState(false);
  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.md,
        }}
      >
        <Image
          source={require('../../assets/images/icon.png')}
          style={{ width: 60, height: 60, borderRadius: radius.lg }}
        />
        <View style={{ gap: spacing.xs }}>
          <Label variant="title">HandyLANdy</Label>
          <Label variant="caption" style={{ color: theme.muted }}>
            Local printer monitoring
          </Label>
        </View>
      </View>
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }} seedColor={theme.accent}>
        <Column
          spacing={24}
          style={{
            width: '100%',
            padding: 16,
            backgroundColor: theme.surface,
            borderRadius: radius.md,
          }}
        >
          <ListItem
            leading={<Icon name="printer" size={20} />}
            trailing={<Icon name="chevron" size={12} color={theme.muted} />}
            onPress={() => router.push('/printers')}
            supportingText={
              <NativeText
                textStyle={{ fontSize: 12, color: theme.muted }}
              >{`${state.profiles.length} saved locally`}</NativeText>
            }
            testID="manage-printers"
          >
            <NativeText textStyle={{ fontSize: 14, color: theme.text }}>My printers</NativeText>
          </ListItem>
          <ListItem
            leading={<Icon name="settings" size={20} />}
            trailing={<Icon name="chevron" size={12} color={theme.muted} />}
            onPress={() => {
              void Linking.openSettings();
            }}
            supportingText={
              <NativeText textStyle={{ fontSize: 12, color: theme.muted }}>
                Local network permission & preferences
              </NativeText>
            }
          >
            <NativeText textStyle={{ fontSize: 14, color: theme.text }}>App settings</NativeText>
          </ListItem>
        </Column>
      </Host>
      {state.demo && (
        <Action
          title="Leave demo"
          onPress={() => {
            state.exitDemo();
            router.replace('/');
          }}
          secondary
        />
      )}
      <Section style={{ gap: spacing.sm }}>
        <Label variant="heading">Local data</Label>
        <Label style={{ color: theme.muted }}>
          Printer profiles are saved on this device. Access codes use the system credential store.
        </Label>
        <Label variant="caption" style={{ color: theme.muted }}>
          Monitoring pauses in the background and reconnects when you return. Background print
          notifications are not available.
        </Label>
      </Section>
      <Action
        title={help ? 'Hide connection help' : 'Connection help'}
        testID="connection-help"
        secondary
        onPress={() => setHelp((value) => !value)}
      />
      {help && (
        <Section>
          <Label variant="heading">Connect on your LAN</Label>
          <Label>1. Keep your phone and printer on the same reachable network.</Label>
          <Label>2. Find the IP, serial number, and LAN access code in the printer settings.</Label>
          <Label>
            3. Enable LAN liveview for the camera. Some firmware requires LAN Only / Developer Mode
            for third-party access.
          </Label>
          <Notice>
            VPNs and guest Wi-Fi isolation can prevent connections. Check local network permission
            in App settings.
          </Notice>
        </Section>
      )}
      <Section style={{ gap: spacing.sm }}>
        <Label variant="heading">About</Label>
        <Label variant="caption" style={{ color: theme.muted }}>
          Version 0.1.0 · Open source · MIT license{'\n'}Independent community project. Not
          affiliated with Bambu Lab.{'\n'}iOS first. Android printer compatibility needs hardware
          validation.
        </Label>
        <Action
          title="PandaBeFree reference ↗"
          secondary
          onPress={() => {
            void Linking.openURL('https://github.com/MiguelSchulz/panda-be-free');
          }}
        />
        <Label variant="caption" style={{ color: theme.muted }}>
          Protocol reference: PandaBeFree (MIT), © 2026 PandaBeFree Contributors. Networking:
          MQTT.js and react-native-tcp-socket (MIT). Camera: react-native-vlc-media-player (MIT),
          MobileVLCKit / libVLC (LGPL). Full notices and source links: THIRD_PARTY_NOTICES.md.
        </Label>
      </Section>
    </Screen>
  );
}
