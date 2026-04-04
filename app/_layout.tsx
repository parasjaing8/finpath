import { Slot } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { ProfileProvider } from '../hooks/useProfile';

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

export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>
      <ProfileProvider>
        <Slot />
      </ProfileProvider>
    </PaperProvider>
  );
}
