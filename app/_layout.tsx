import React, { useEffect } from 'react';
import { Slot } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { ProfileProvider } from '../hooks/useProfile';
import { ProProvider } from '../hooks/usePro';
import { AppProvider } from '../context/AppContext';
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
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Render nothing until fonts are ready (avoids FOUT on first paint)
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ErrorBoundary>
          <PaperProvider theme={theme}>
            <AppProvider>
              <ProProvider>
                <ProfileProvider>
                  <Slot />
                </ProfileProvider>
              </ProProvider>
            </AppProvider>
          </PaperProvider>
        </ErrorBoundary>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
