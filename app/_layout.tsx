import React from 'react';
import { Slot } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { ProfileProvider } from '../hooks/useProfile';
import { ProProvider } from '../hooks/usePro';
import * as Sentry from '@sentry/react-native';
import { ErrorBoundary } from '../components/ErrorBoundary';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  // Set tracesSampleRate to 1.0 to capture 100% of transactions in development.
  // Lower this in production (e.g. 0.2) to reduce volume.
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
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
        <ProProvider>
          <ProfileProvider>
            <Slot />
          </ProfileProvider>
        </ProProvider>
      </PaperProvider>
    </ErrorBoundary>
  );
}

export default Sentry.wrap(RootLayout);
