import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Switch, Divider } from 'react-native-paper';
import { useProfile } from '../../hooks/useProfile';
import { deleteProfile, getBiometricEnabled, setBiometricEnabled } from '../../db/queries';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { currentProfile, logout } = useProfile();
  const router = useRouter();
  const [biometricOn, setBiometricOn] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const loadBiometric = useCallback(async () => {
    if (!currentProfile) return;
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(hasHardware && isEnrolled);
    if (hasHardware && isEnrolled) {
      const enabled = await getBiometricEnabled(currentProfile.id);
      setBiometricOn(enabled);
    }
  }, [currentProfile]);

  useFocusEffect(useCallback(() => { loadBiometric(); }, [loadBiometric]));

  const handleLogout = useCallback(() => {
    logout();
    router.replace('/login');
  }, [logout, router]);

  const handleDeleteProfile = useCallback(() => {
    if (!currentProfile) return;
    Alert.alert(
      'Delete Profile',
      `Permanently delete "${currentProfile.name}" and all associated assets, expenses, and goals? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProfile(currentProfile.id);
              logout();
              router.replace('/login');
            } catch (e) {
              Alert.alert('Error', 'Could not delete profile. Please try again.');
            }
          },
        },
      ]
    );
  }, [currentProfile, logout, router]);

  if (!currentProfile) {
    return <View style={styles.center}><Text>No profile selected</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>

      {/* Profile info */}
      <Card style={styles.card}>
        <Card.Content style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{currentProfile.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text variant="titleMedium" style={{ fontWeight: '700' }}>{currentProfile.name}</Text>
            {currentProfile.monthly_income != null && currentProfile.monthly_income > 0 && (
              <Text variant="bodySmall" style={{ color: '#666', marginTop: 2 }}>
                Monthly income: {currentProfile.currency}{((currentProfile.monthly_income ?? 0) / 1000).toFixed(0)}K
              </Text>
            )}
          </View>
        </Card.Content>
      </Card>

      {/* Security */}
      <Text variant="labelSmall" style={styles.sectionLabel}>SECURITY</Text>
      <Card style={styles.card}>
        <Card.Content>
          {biometricAvailable ? (
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <MaterialCommunityIcons name="fingerprint" size={22} color="#1B5E20" />
                <Text style={styles.settingText}>Fingerprint Login</Text>
              </View>
              <Switch
                value={biometricOn}
                onValueChange={async (val) => {
                  await setBiometricEnabled(currentProfile.id, val);
                  setBiometricOn(val);
                }}
                color="#1B5E20"
              />
            </View>
          ) : (
            <Text variant="bodySmall" style={{ color: '#999' }}>
              No biometric hardware enrolled on this device.
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* Account actions */}
      <Text variant="labelSmall" style={styles.sectionLabel}>ACCOUNT</Text>
      <Card style={styles.card}>
        <Card.Content>
          <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/onboarding/edit-profile')} accessibilityRole="button">
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="account-edit-outline" size={22} color="#555" />
              <Text style={styles.settingText}>Edit Profile</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
          </TouchableOpacity>
          <Divider style={{ marginVertical: 4 }} />
          <TouchableOpacity style={styles.settingRow} onPress={handleDeleteProfile} accessibilityRole="button">
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="account-remove-outline" size={22} color="#C62828" />
              <Text style={[styles.settingText, { color: '#C62828' }]}>Delete Profile</Text>
            </View>
          </TouchableOpacity>
        </Card.Content>
      </Card>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  card: { borderRadius: 12, marginBottom: 12 },
  sectionLabel: { color: '#999', letterSpacing: 1, marginBottom: 6, marginLeft: 4, marginTop: 8 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1B5E20', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingText: { fontSize: 15, color: '#333' },
});
