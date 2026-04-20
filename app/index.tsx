import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeDatabase } from '../db/schema';
import { getAllProfiles } from '../db/queries';

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initializeDatabase();
        const profiles = await getAllProfiles();
        if (profiles.length > 0) {
          setTarget('/login');
        } else {
          const onboarded = await AsyncStorage.getItem('@fire_onboarded');
          setTarget(onboarded === '1' ? '/login' : '/onboarding/create-profile');
        }
      } catch (e) {
        if (__DEV__) console.error('Init error:', e);
        setTarget('/onboarding/create-profile');
      }
    })();
  }, []);

  if (!target) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' }}>
        <ActivityIndicator size="large" color="#1B5E20" />
      </View>
    );
  }

  return <Redirect href={target as any} />;
}
