import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Action, Label, Loading, Notice, Section } from '@/components/ui';
import { CameraPanel } from '@/components/camera-panel';
import { Icon, IconButton } from '@/components/icon';
import { PrinterArt } from '@/components/printer-art';
import type { FilamentTray, PrinterStatus } from '@/printer/types';
import { usePrinters } from '@/state/printers';
import { radius, spacing, useTheme } from '@/theme';
import { formatDuration, formatTemperature, isStatusStale } from '@/utils/format';

function DeviceHeader() {
  const state = usePrinters();
  const theme = useTheme();
  const { connection, status } = state.snapshot;
  const online = connection === 'connected' && !isStatusStale(status.lastReportAt, state.now);
  const description = state.demo
    ? 'Sample printer'
    : !state.profile
      ? 'Direct LAN monitoring'
      : !state.foreground
        ? 'Paused in background'
        : online
          ? 'Online · LAN'
          : connection === 'connected'
            ? 'Waiting for status'
            : connection;
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: theme.surface }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: spacing.md,
          paddingRight: spacing.sm,
          paddingVertical: spacing.xs,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose printer"
          testID="open-printers"
          onPress={() => router.push('/printers')}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            minHeight: 48,
          }}
        >
          <Icon name="printer" color={theme.accent} size={28} />
          <View style={{ flexShrink: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Label variant="heading" numberOfLines={1} style={{ flexShrink: 1 }}>
                {state.profile?.name ?? 'HandyLANdy'}
              </Label>
              <Icon name="chevron" size={10} color={theme.muted} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <View
                style={{
                  height: 5,
                  width: 5,
                  borderRadius: radius.full,
                  backgroundColor: online || state.demo ? theme.accent : theme.muted,
                }}
              />
              <Label variant="caption" style={{ color: theme.muted }}>
                {description}
              </Label>
            </View>
          </View>
        </Pressable>
        <IconButton
          name="plus"
          label="Add printer"
          testID="add-printer"
          disabled={state.loading || !!state.loadError}
          onPress={() => router.push('/profile')}
        />
        <IconButton
          name="settings"
          label="Settings"
          testID="open-settings"
          onPress={() => router.push('/settings')}
        />
      </View>
    </SafeAreaView>
  );
}

function JobSummary({ status }: { status: PrinterStatus }) {
  const theme = useTheme();
  const progress =
    status.progress === undefined ? undefined : Math.min(100, Math.max(0, status.progress));
  const printState = status.state?.replaceAll('_', ' ') ?? 'No print status';
  return (
    <Section style={{ gap: spacing.sm, padding: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.background,
          }}
        >
          <PrinterArt size={48} />
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Label variant="label" numberOfLines={1}>
            {status.jobName || 'Print details unavailable'}
          </Label>
          <Label variant="caption" style={{ color: theme.muted }}>
            {printState} · Layer {status.layer ?? '—'}/{status.totalLayers ?? '—'}
          </Label>
        </View>
        <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
          <Label variant="title" style={{ fontVariant: ['tabular-nums'] }}>
            {progress === undefined ? '—' : `${Math.round(progress)}%`}
          </Label>
          <Label variant="caption" style={{ color: theme.muted }}>
            {formatDuration(status.remainingMinutes)} left
          </Label>
        </View>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: 100,
          now: progress,
          text: progress === undefined ? 'Progress unavailable' : `${progress} percent`,
        }}
        style={{
          height: 3,
          borderRadius: radius.full,
          backgroundColor: theme.control,
          overflow: 'hidden',
        }}
      >
        <View
          style={{ height: '100%', width: `${progress ?? 0}%`, backgroundColor: theme.accent }}
        />
      </View>
    </Section>
  );
}

function DeviceReadings({ status }: { status: PrinterStatus }) {
  const theme = useTheme();
  const reading = (label: string, value?: number, target?: number) => (
    <View style={{ gap: 3 }}>
      <Label variant="caption" style={{ color: theme.muted }}>
        {label}
      </Label>
      <Label variant="title" style={{ fontVariant: ['tabular-nums'] }}>
        {value === undefined ? '—' : Math.round(value)}
        <Label variant="caption" style={{ color: theme.muted }}>
          °C
        </Label>
      </Label>
      <Label variant="caption" style={{ color: theme.muted }}>
        /{target === undefined ? '—' : Math.round(target)}°C
      </Label>
    </View>
  );
  return (
    <View style={{ gap: spacing.sm }}>
      <Label variant="heading">Device Status</Label>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Section style={{ flex: 1.1, padding: 12, gap: 12 }}>
          <Label variant="label" style={{ color: theme.muted }}>
            Nozzle & heated bed
          </Label>
          <View
            style={{
              flex: 1,
              minHeight: 105,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {reading('Nozzle', status.nozzleTemperature, status.nozzleTarget)}
            <View style={{ width: 1, height: 46, backgroundColor: theme.line }} />
            {reading('Bed', status.bedTemperature, status.bedTarget)}
          </View>
        </Section>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Section style={{ flex: 1, padding: 12, gap: 6 }}>
            <Label variant="label" style={{ color: theme.muted }}>
              Chamber
            </Label>
            <Label variant="heading">{formatTemperature(status.chamberTemperature)}</Label>
          </Section>
          <Section style={{ flex: 1, padding: 12, gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Label variant="label" style={{ color: theme.muted }}>
                Cooling
              </Label>
              <Icon name="fan" size={14} color={theme.muted} />
            </View>
            <Label variant="heading">
              {status.partFan === undefined ? '—' : `${Math.round(status.partFan)}%`}
            </Label>
            <Label variant="caption" style={{ color: theme.muted }}>
              Aux {status.auxiliaryFan ?? '—'}% · Chamber {status.chamberFan ?? '—'}%
            </Label>
          </Section>
        </View>
      </View>
    </View>
  );
}

function Spool({ tray }: { tray: FilamentTray }) {
  const theme = useTheme();
  const color = tray.color ?? theme.control;
  return (
    <View
      accessibilityLabel={`Slot ${Number(tray.id) + 1}, ${tray.material ?? 'unknown material'}, ${tray.remaining === undefined ? 'remaining unavailable' : `${tray.remaining} percent remaining`}`}
      style={{ flex: 1, minWidth: 54, alignItems: 'center', gap: spacing.sm }}
    >
      <Label variant="caption" style={{ color: theme.muted }}>
        {tray.material || 'Empty'}
      </Label>
      <View style={{ width: 56, height: 72, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            left: 7,
            right: 7,
            top: 7,
            bottom: 7,
            backgroundColor: color,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 21,
            borderRadius: 36,
            backgroundColor: color,
            borderWidth: 3,
            borderColor: theme.dark ? '#4D4D4D' : '#D5D5D5',
          }}
        />
        <View
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 22,
            borderRadius: 36,
            backgroundColor: theme.dark ? '#484848' : '#D1D1D1',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              height: 17,
              width: 6,
              borderRadius: 8,
              backgroundColor: theme.dark ? '#222222' : '#8A8A8A',
            }}
          />
        </View>
      </View>
      <Label variant="caption">
        A{Number(tray.id) + 1}{' '}
        <Label variant="caption" style={{ color: theme.muted }}>
          · {tray.remaining === undefined ? '—' : `${tray.remaining}%`}
        </Label>
      </Label>
    </View>
  );
}

function FilamentSection({ status }: { status: PrinterStatus }) {
  const theme = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Label variant="heading">Filament</Label>
      {status.ams?.length ? (
        status.ams.map((unit) => (
          <Section key={unit.id} style={{ padding: 12, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name="filament" size={20} color={theme.accent} />
              <Label variant="label" style={{ flex: 1 }}>
                AMS {unit.id}
              </Label>
              <Label variant="caption" style={{ color: theme.muted }}>
                Humidity {unit.humidity ?? '—'} · {formatTemperature(unit.temperature)}
              </Label>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {unit.trays.map((tray) => (
                <Spool key={tray.id} tray={tray} />
              ))}
            </View>
          </Section>
        ))
      ) : (
        <Section>
          <Label style={{ color: theme.muted }}>No AMS data reported.</Label>
        </Section>
      )}
    </View>
  );
}

export default function DashboardScreen() {
  const state = usePrinters();
  const theme = useTheme();
  const { status, connection, error } = state.snapshot;
  const stale = !state.demo && isStatusStale(status.lastReportAt, state.now);
  const cancel = connection === 'connecting' || connection === 'reconnecting';
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DeviceHeader />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          padding: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: spacing.lg,
          gap: spacing.md,
          maxWidth: 760,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {state.loading ? (
          <Loading />
        ) : state.loadError ? (
          <>
            <Notice error>{state.loadError}</Notice>
            <Action
              title="Try again"
              onPress={() => {
                void state.reload();
              }}
            />
            <Action title="Explore demo" secondary onPress={state.showDemo} />
          </>
        ) : !state.profile ? (
          <>
            <View style={{ height: 260, alignItems: 'center', justifyContent: 'center' }}>
              <PrinterArt size={210} />
            </View>
            <Section>
              <Label variant="heading">Add your printer</Label>
              <Label style={{ color: theme.muted }}>
                View printer status and camera over your local network.
              </Label>
              <Action
                title="Add printer"
                testID="connect-first"
                onPress={() => router.push('/profile')}
              />
            </Section>
            <Action
              title="Try a demo printer"
              testID="open-demo"
              secondary
              onPress={state.showDemo}
            />
            <Label variant="caption" style={{ textAlign: 'center', color: theme.muted }}>
              Have your printer IP, serial number, and LAN access code ready.
            </Label>
          </>
        ) : (
          <>
            {state.demo && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Label variant="caption" style={{ color: theme.muted }}>
                  Demo mode · Sample readings
                </Label>
                <Pressable accessibilityRole="button" onPress={state.exitDemo} hitSlop={12}>
                  <Label variant="caption" style={{ color: theme.accent }}>
                    Exit demo
                  </Label>
                </Pressable>
              </View>
            )}
            <CameraPanel />
            {error && <Notice error>{error}</Notice>}
            {stale && status.lastReportAt !== undefined && (
              <Notice>
                Last report {Math.floor((state.now - status.lastReportAt) / 1000)} seconds ago.
                Readings may have changed.
              </Notice>
            )}
            <JobSummary status={status} />
            <DeviceReadings status={status} />
            <FilamentSection status={status} />
            {!state.demo && (
              <Action
                title={
                  cancel
                    ? 'Cancel connection'
                    : state.enabled && connection === 'connected'
                      ? 'Disconnect printer'
                      : 'Reconnect printer'
                }
                secondary
                onPress={
                  cancel || (state.enabled && connection === 'connected')
                    ? state.disconnect
                    : state.reconnect
                }
              />
            )}
            <Label variant="caption" style={{ color: theme.muted, textAlign: 'center' }}>
              {state.demo
                ? 'Sample data · No printer connected'
                : 'Direct LAN · Foreground monitoring'}
            </Label>
          </>
        )}
      </ScrollView>
    </View>
  );
}
