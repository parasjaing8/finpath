import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { PaperProvider, MD3LightTheme, Text, Button } from 'react-native-paper';
import { ProfileProvider } from '../hooks/useProfile';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  // Set tracesSampleRate to 1.0 to capture 100% of transactions in development.
  // Lower this in production (e.g. 0.2) to reduce volume.
  tracesSampleRate: 1.0,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
});

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text variant="headlineSmall" style={errorStyles.title}>Something went wrong</Text>
          <Text variant="bodyMedium" style={errorStyles.message}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </Text>
          <Button
            mode="contained"
            onPress={() => this.setState({ hasError: false, error: null })}
            style={errorStyles.button}
          >
            Try Again
          </Button>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#F5F5F5' },
  title: { fontWeight: 'bold', color: '#B71C1C', marginBottom: 12 },
  message: { color: '#555', textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: '#1B5E20' },
});

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1B5E20',
    primaryContainer: '#C8E6C9',
    secondary: '#33691E',
    secondaryContainer: '#DCEDC8',
    surface: '#FFFFFF',
    background: '#F5F5F5',
  },
};

function RootLayout() {
  return (
    <ErrorBoundary>
      <PaperProvider theme={theme}>
        <ProfileProvider>
          <Slot />
        </ProfileProvider>
      </PaperProvider>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
