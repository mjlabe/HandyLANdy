import { Button, Host, Text as NativeText } from '@expo/ui';
import { contentShape, frame, padding, shapes } from '@expo/ui/swift-ui/modifiers';
import type { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';
import { radius, spacing, typography, useTheme } from '@/theme';

export function Label({
  variant = 'body',
  style,
  ...props
}: TextProps & { variant?: keyof typeof typography }) {
  const theme = useTheme();
  return <Text selectable {...props} style={[typography[variant], { color: theme.text }, style]} />;
}

export function Section({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.surface,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          padding: spacing.md,
          gap: spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Screen({ children }: PropsWithChildren) {
  const theme = useTheme();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.background, flex: 1 }}
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: spacing.lg,
        gap: spacing.md,
        width: '100%',
        maxWidth: 760,
        alignSelf: 'center',
      }}
    >
      {children}
    </ScrollView>
  );
}

export function Action({
  title,
  onPress,
  secondary,
  disabled,
  testID,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const ios = Platform.OS === 'ios';
  return (
    <Host
      matchContents={{ vertical: true }}
      seedColor={theme.accent}
      style={{ minHeight: 44, width: '100%', opacity: disabled ? 0.45 : 1 }}
    >
      <Button
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        variant="text"
        style={{
          width: '100%',
          paddingVertical: ios ? 0 : 12,
          paddingHorizontal: ios ? 0 : spacing.md,
          borderRadius: radius.sm,
          backgroundColor: secondary ? theme.control : theme.accent,
        }}
      >
        <NativeText
          // SwiftUI hit-tests the label, so its padding and content shape belong here.
          modifiers={
            ios
              ? [
                  padding({ vertical: 12, horizontal: spacing.md }),
                  frame({ minHeight: 44, maxWidth: Infinity, alignment: 'center' }),
                  contentShape(shapes.rectangle()),
                ]
              : undefined
          }
          textStyle={{
            fontSize: 14,
            fontWeight: '600',
            textAlign: 'center',
            color: secondary ? theme.text : theme.onAccent,
          }}
        >
          {title}
        </NativeText>
      </Button>
    </Host>
  );
}

export function Notice({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{ padding: spacing.sm, borderRadius: radius.sm, backgroundColor: theme.accentSoft }}
    >
      <Label variant="caption" style={{ color: error ? theme.danger : theme.text, lineHeight: 16 }}>
        {children}
      </Label>
    </View>
  );
}

export function Loading({ text = 'Loading printers…' }: { text?: string }) {
  const theme = useTheme();
  return (
    <Section>
      <ActivityIndicator color={theme.accent} />
      <Label style={{ textAlign: 'center' }}>{text}</Label>
    </Section>
  );
}
