import { useEffect } from 'react';
import { useRouter } from 'expo-router';

// Handles unmatched routes — most commonly content:// import URIs that Expo Router
// rewrites as finpath://com.provider.*/... and can't route. LinkingHandler in
// _layout.tsx detects and processes these URIs independently; this route just
// redirects back to the app shell so no error screen is shown.
export default function NotFound() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)');
  }, []);
  return null;
}
