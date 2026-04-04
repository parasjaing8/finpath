import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { initializeDatabase } from '../db/schema';
import { getAllProfiles } from '../db/queries';
import { useProfile } from '../hooks/useProfile';

export default function Index() {
  const { setCurrentProfileId } = useProfile();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await initializeDatabase();
        const profiles = await getAllProfiles();
        if (profiles.length > 0) {
          await setCurrentProfileId(profiles[0].id);
          setTarget('/(tabs)/assets');
        } else {
          setTarget('/onboarding/create-profile');
        }
      } catch (e) {
        console.error('Init error:', e);
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
