import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';

import { useApp } from '@/context/AppContext';
import { hasCredentials } from '@/storage/auth';
import { isUnlockedForSession } from '@/storage/session';
import { useColors } from '@/hooks/useColors';

/**
 * Root entry. Routing decisions in priority order:
 *   1. Wait for AppContext to finish loading from encrypted storage.
 *   2. If the user has never onboarded → /onboarding
 *   3. If a PIN is set and we haven't unlocked this session → /lock
 *   4. Otherwise → /(tabs)/dashboard
 *
 * The credential check is async so we render a tiny loader until it resolves
 * to avoid a one-frame redirect to the dashboard before the lock screen.
 */
export default function Index() {
  const { isLoaded, onboarded } = useApp();
  const colors = useColors();
  const [credsChecked, setCredsChecked] = useState(false);
  const [hasPin, setHasPin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isLoaded || !onboarded) return;
    hasCredentials().then(v => {
      if (cancelled) return;
      setHasPin(v);
      setCredsChecked(true);
    });
    return () => { cancelled = true; };
  }, [isLoaded, onboarded]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!onboarded) return <Redirect href="/onboarding" />;

  if (!credsChecked) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (hasPin && !isUnlockedForSession()) return <Redirect href="/lock" />;

  return <Redirect href="/(tabs)/dashboard" />;
}
