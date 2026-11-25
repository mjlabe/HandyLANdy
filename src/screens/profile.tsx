import { Host, Picker, Switch } from '@expo/ui';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { Action, Label, Notice, Screen, Section } from '@/components/ui';
import { IconButton } from '@/components/icon';
import type { CameraProtocol, PrinterProfile } from '@/printer/types';
import { validateProfile } from '@/printer/validation';
import { usePrinters } from '@/state/printers';
import { profileRepository } from '@/storage/repository';
import { radius, spacing, useTheme } from '@/theme';

const models = [
  'X1 Carbon',
  'X1',
  'X1E',
  'P1S',
  'P1P',
  'A1',
  'A1 Mini',
  'P2S',
  'H2D',
  'H2S',
  'H2C',
];
const jpegModels = new Set(['P1S', 'P1P', 'A1', 'A1 Mini']);

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const state = usePrinters();
  const existing = state.profiles.find((profile) => profile.id === id);
  const theme = useTheme();
  const [profileId] = useState(
    () => existing?.id ?? `printer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  const [draft, setDraft] = useState<Omit<PrinterProfile, 'id'>>(
    existing ?? {
      name: '',
      host: '',
      serial: '',
      model: 'X1 Carbon',
      cameraProtocol: 'rtsps',
      trustSelfSigned: false,
    },
  );
  const [accessCode, setAccessCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [readingCode, setReadingCode] = useState(!!existing);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void profileRepository
      .getAccessCode(id)
      .then((code) => {
        if (!cancelled) setAccessCode(code ?? '');
      })
      .catch(() => {
        if (!cancelled)
          setFailure('The saved access code could not be read. Enter it again to save changes.');
      })
      .finally(() => {
        if (!cancelled) setReadingCode(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function field(
    name: 'name' | 'host' | 'serial' | 'accessCode',
    label: string,
    placeholder: string,
    secure = false,
  ) {
    const value = name === 'accessCode' ? accessCode : draft[name];
    return (
      <View style={{ gap: spacing.sm }} key={name}>
        <Label variant="label">{label}</Label>
        <TextInput
          testID={`field-${name}`}
          accessibilityLabel={label}
          value={value}
          onChangeText={(text) => {
            if (name === 'accessCode') setAccessCode(text);
            else setDraft((current) => ({ ...current, [name]: text }));
          }}
          placeholder={placeholder}
          placeholderTextColor={theme.muted}
          secureTextEntry={secure}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          spellCheck={false}
          maxLength={name === 'accessCode' ? 32 : name === 'name' ? 80 : 253}
          editable={!busy && !readingCode}
          keyboardType={name === 'host' ? 'url' : 'default'}
          style={{
            color: theme.text,
            backgroundColor: theme.background,
            fontSize: 15,
            padding: 12,
            borderRadius: radius.sm,
            minHeight: 44,
          }}
        />
        {errors[name] && (
          <Label variant="caption" style={{ color: theme.danger }}>
            {errors[name]}
          </Label>
        )}
      </View>
    );
  }

  async function save() {
    const profile = {
      ...draft,
      name: draft.name.trim(),
      host: draft.host.trim(),
      serial: draft.serial.trim(),
    };
    const nextErrors = validateProfile(profile, accessCode);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    setFailure(undefined);
    try {
      await state.saveProfile({ ...profile, id: profileId }, accessCode);
      router.dismissAll();
      router.replace('/');
    } catch {
      setFailure(
        'This printer could not be saved securely. Your entries are still here; unlock the device and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!existing) return;
    Alert.alert(
      'Remove printer?',
      `Remove ${existing.name} and its saved access code from this device?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            void state
              .removeProfile(existing.id)
              .then(() => {
                router.dismissAll();
                router.replace('/printers');
              })
              .catch(() => {
                setFailure('The printer could not be removed. Try again.');
              })
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }

  if (id && !existing)
    return (
      <Screen>
        <Notice error>This saved printer is unavailable.</Notice>
        <Action title="Back to printers" onPress={() => router.replace('/printers')} />
      </Screen>
    );
  return (
    <Screen>
      <Stack.Screen
        options={{
          title: existing ? 'Edit printer' : 'Add printer',
          gestureEnabled: !busy,
          headerLeft: () => (
            <IconButton
              name="close"
              label="Cancel editing printer"
              testID="close-profile"
              disabled={busy}
              onPress={() => router.back()}
            />
          ),
        }}
      />
      <Notice>
        Find the IP address, serial number, and LAN access code on your printer. Keep your phone and
        printer on the same local network.
      </Notice>
      <Section>
        {field('name', 'Printer name', 'Workshop printer')}
        {field('host', 'IP address or hostname', '192.168.1.42')}
        {field('serial', 'Serial number', 'Printer serial number')}
        {field(
          'accessCode',
          'LAN access code',
          readingCode ? 'Reading secure storage…' : 'From printer network settings',
          true,
        )}
      </Section>
      <Section>
        <Label variant="label">Printer model</Label>
        <Host matchContents seedColor={theme.accent}>
          <Picker
            accessibilityLabel="Printer model"
            testID="model-picker"
            selectedValue={draft.model}
            enabled={!busy}
            onValueChange={(model) =>
              setDraft((current) => ({
                ...current,
                model,
                cameraProtocol: jpegModels.has(model) ? 'jpeg' : 'rtsps',
              }))
            }
          >
            {models.map((model) => (
              <Picker.Item key={model} label={`${model} · unverified`} value={model} />
            ))}
          </Picker>
        </Host>
        <Label variant="label">Camera transport</Label>
        <Host matchContents seedColor={theme.accent}>
          <Picker
            accessibilityLabel="Camera transport"
            selectedValue={draft.cameraProtocol}
            enabled={!busy}
            onValueChange={(cameraProtocol: CameraProtocol) =>
              setDraft((current) => ({ ...current, cameraProtocol }))
            }
          >
            <Picker.Item label="RTSPS · X1 / P2 / H2 families" value="rtsps" />
            <Picker.Item label="TLS JPEG · P1 / A1 families" value="jpeg" />
          </Picker>
        </Host>
        <Label variant="caption" style={{ color: theme.muted }}>
          The model suggests a camera transport. You can override it for your printer. All model
          profiles are unverified on physical hardware.
        </Label>
      </Section>
      <Section>
        <Host matchContents seedColor={theme.accent}>
          <Switch
            label="Allow printer self-signed certificate"
            testID="trust-certificate"
            disabled={busy}
            value={draft.trustSelfSigned}
            onValueChange={(trustSelfSigned) =>
              setDraft((current) => ({ ...current, trustSelfSigned }))
            }
          />
        </Host>
        <Label variant="caption" style={{ color: theme.muted }}>
          Bambu printers normally use self-signed TLS certificates. Enabling this allows an
          encrypted connection without verifying this printer’s identity. This choice applies only
          to this saved printer.
        </Label>
      </Section>
      {failure && <Notice error>{failure}</Notice>}
      <Action
        title={busy ? 'Saving…' : 'Save and connect'}
        testID="save-printer"
        disabled={busy || readingCode}
        onPress={() => {
          void save();
        }}
      />
      {existing && <Action title="Remove printer" secondary disabled={busy} onPress={remove} />}
    </Screen>
  );
}
