import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { reloadAppAsync } from 'expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '../hooks/useColors';

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const handleRestart = async () => {
    try {
      await reloadAppAsync();
    } catch {
      resetError();
    }
  };

  const monoFont = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <MaterialCommunityIcons
        name="alert-circle-outline"
        size={52}
        color={colors.destructive}
        style={styles.icon}
      />
      <Text style={[styles.title, { color: colors.foreground }]}>Something went wrong</Text>
      <Text style={[styles.message, { color: colors.mutedForeground }]}>
        Please reload the app to continue.
      </Text>

      {__DEV__ && (
        <ScrollView style={styles.devScroll} contentContainerStyle={styles.devContent}>
          <Text style={[styles.devText, { fontFamily: monoFont, color: colors.destructive }]} selectable>
            {error.message}
          </Text>
          {error.stack ? (
            <Text style={[styles.devStack, { fontFamily: monoFont, color: colors.mutedForeground }]} selectable>
              {error.stack}
            </Text>
          ) : null}
        </ScrollView>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={handleRestart}
        accessibilityRole="button"
        accessibilityLabel="Reload app"
      >
        <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  devScroll: {
    maxHeight: 200,
    width: '100%',
    marginBottom: 24,
    borderRadius: 8,
    backgroundColor: '#F8F8F8',
  },
  devContent: {
    padding: 12,
  },
  devText: {
    fontSize: 12,
    marginBottom: 8,
  },
  devStack: {
    fontSize: 10,
    lineHeight: 16,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
