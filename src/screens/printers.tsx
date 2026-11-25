import { Column, Host, ListItem, Text as NativeText } from '@expo/ui';
import { router } from 'expo-router';
import { View } from 'react-native';
import { PrinterArt } from '@/components/printer-art';
import { Icon } from '@/components/icon';
import { Action, Label, Loading, Notice, Screen, Section } from '@/components/ui';
import { usePrinters } from '@/state/printers';
import { radius, useTheme } from '@/theme';

export default function PrintersScreen() {
  const state = usePrinters();
  const theme = useTheme();
  return <Screen>
    <Label variant="caption" style={{ color: theme.muted }}>Connect directly. No account required.</Label>
    {state.loading ? <Loading /> : state.loadError ? <><Notice error>{state.loadError}</Notice><Action title="Try again" onPress={() => { void state.reload(); }} /></> : state.profiles.length ?
      <Host matchContents={{ vertical: true }} style={{ width: '100%' }} seedColor={theme.accent}><Column spacing={24} style={{ width: '100%', padding: 16, backgroundColor: theme.surface, borderRadius: radius.md }}>{state.profiles.map(profile => <ListItem key={profile.id} leading={<PrinterArt size={42} />} testID={`printer-${profile.id}`} onPress={() => { state.select(profile.id); router.replace('/'); }} supportingText={`${profile.model} · ${profile.host}`} trailing={<NativeText>{state.profile?.id === profile.id && !state.demo ? 'Selected' : 'Select'}</NativeText>}><NativeText>{profile.name}</NativeText></ListItem>)}</Column></Host>
      : <Section><View style={{ alignItems: 'center', padding: 16 }}><PrinterArt size={150} /></View><Label variant="heading">No printers yet</Label><Label style={{ color: theme.muted }}>Add a printer with its local IP, serial number, and LAN access code.</Label></Section>}
    <Action title="Add printer" testID="add-printer" disabled={state.loading || !!state.loadError} onPress={() => router.push('/profile')} />
    {state.profile && !state.demo && <Action title={`Edit ${state.profile.name}`} secondary onPress={() => router.push({ pathname: '/profile', params: { id: state.profile!.id } })} />}
    <Section><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="printer" color={theme.accent} /><Label variant="heading">Demo printer</Label></View><Label style={{ color: theme.muted }}>Sample status, camera illustration, and AMS readings.</Label><Action title="Open demo" secondary testID="open-demo" onPress={() => { state.showDemo(); router.replace('/'); }} /></Section>
  </Screen>;
}
