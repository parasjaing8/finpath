import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1B5E20',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#FFFFFF',
          borderTopColor: '#D8DED8',
        },
        tabBarBackground: () =>
          Platform.OS === 'ios'
            ? <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
            : null,
        headerStyle: { backgroundColor: '#1B5E20' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' as const },
      }}
    >
      <Tabs.Screen
        name="assets"
        options={{
          title: 'Assets',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="wallet-outline" size={size} color={color} />,
          tabBarAccessibilityLabel: 'Assets tab',
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cash-minus" size={size} color={color} />,
          tabBarAccessibilityLabel: 'Expenses tab',
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Goals',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="flag-outline" size={size} color={color} />,
          tabBarAccessibilityLabel: 'Goals tab',
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-dashboard-outline" size={size} color={color} />,
          tabBarAccessibilityLabel: 'Dashboard tab',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-circle-outline" size={size} color={color} />,
          tabBarAccessibilityLabel: 'Profile tab',
        }}
      />
    </Tabs>
  );
}
