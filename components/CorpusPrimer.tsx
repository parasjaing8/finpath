import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Dialog, Portal } from 'react-native-paper';
import * as SecureStore from 'expo-secure-store';

const primerKey = (profileId: number) => `finpath_corpus_primer_seen_${profileId}`;

interface Props {
  profileId: number;
}

export function CorpusPrimer({ profileId }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const seen = await SecureStore.getItemAsync(primerKey(profileId));
        if (!seen) setVisible(true);
      } catch {
        // If SecureStore fails, don't block the user
      }
    }
    check();
  }, [profileId]);

  async function dismiss() {
    setVisible(false);
    try {
      await SecureStore.setItemAsync(primerKey(profileId), '1');
    } catch {
      // Non-critical — worst case they see it again next visit
    }
  }

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={dismiss} style={styles.dialog}>
        <Dialog.Title style={styles.title}>How FinPath plans your retirement</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <View style={styles.content}>

            <View style={styles.block}>
              <Text style={styles.emoji}>🏦</Text>
              <View style={styles.blockText}>
                <Text variant="labelLarge" style={styles.blockTitle}>Your Retirement Corpus</Text>
                <Text variant="bodySmall" style={styles.blockBody}>
                  A corpus is the lump-sum pot of money you build up before retiring. After you retire,
                  your salary stops — this pot becomes your only source of income.
                </Text>
              </View>
            </View>

            <View style={styles.block}>
              <Text style={styles.emoji}>💸</Text>
              <View style={styles.blockText}>
                <Text variant="labelLarge" style={styles.blockTitle}>Monthly Retirement Withdrawal</Text>
                <Text variant="bodySmall" style={styles.blockBody}>
                  This is how much you want to withdraw from your corpus each month after retiring.
                  Think of it as your post-retirement "salary" — paid by your own savings, not an
                  employer or government.
                </Text>
              </View>
            </View>

            <View style={styles.block}>
              <Text style={styles.emoji}>📐</Text>
              <View style={styles.blockText}>
                <Text variant="labelLarge" style={styles.blockTitle}>Safe Withdrawal Rate (SWR)</Text>
                <Text variant="bodySmall" style={styles.blockBody}>
                  SWR is the % of your corpus you withdraw each year. At 5% SWR, a{' '}
                  <Text style={{ fontWeight: '700' }}>₹2 Cr corpus</Text> gives you{' '}
                  <Text style={{ fontWeight: '700' }}>₹10 L/yr</Text> (₹83K/mo).{'\n'}
                  Lower SWR = larger corpus needed, but your money lasts longer.
                </Text>
              </View>
            </View>

            <View style={styles.block}>
              <Text style={styles.emoji}>📈</Text>
              <View style={styles.blockText}>
                <Text variant="labelLarge" style={styles.blockTitle}>How SIP builds your corpus</Text>
                <Text variant="bodySmall" style={styles.blockBody}>
                  A Systematic Investment Plan (SIP) is a fixed monthly investment into mutual funds or
                  equity. FinPath calculates the SIP needed so your corpus at retirement is large enough
                  to fund your withdrawal target for life.
                </Text>
              </View>
            </View>

            <View style={[styles.block, styles.tipBlock]}>
              <Text style={styles.emoji}>💡</Text>
              <Text variant="bodySmall" style={[styles.blockBody, { flex: 1 }]}>
                Start by filling in your <Text style={{ fontWeight: '700' }}>retirement age</Text> and
                {' '}<Text style={{ fontWeight: '700' }}>monthly withdrawal target</Text> below.
                The Dashboard will instantly show your required SIP and FIRE projection.
              </Text>
            </View>

          </View>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button mode="contained" onPress={dismiss} style={styles.button}>
            Got it, let's plan!
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { backgroundColor: '#FFF', borderRadius: 16, maxHeight: '85%' },
  title: { fontWeight: '700', color: '#1B5E20', fontSize: 17 },
  scrollArea: { paddingHorizontal: 0, maxHeight: 420 },
  content: { paddingHorizontal: 20, paddingVertical: 8 },
  block: { flexDirection: 'row', gap: 12, marginBottom: 18, alignItems: 'flex-start' },
  emoji: { fontSize: 22, marginTop: 1 },
  blockText: { flex: 1 },
  blockTitle: { fontWeight: '700', color: '#1B5E20', marginBottom: 4 },
  blockBody: { color: '#555', lineHeight: 19 },
  tipBlock: { backgroundColor: '#F1F8E9', borderRadius: 10, padding: 12, marginTop: 4 },
  button: { borderRadius: 8, marginBottom: 4, paddingHorizontal: 8 },
});
