import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Text, Button, Dialog, Portal } from 'react-native-paper';
import * as SecureStore from 'expo-secure-store';

const dialogKey = (id: number) => `finpath_corpus_primer_seen_${id}`;
const hintKey   = (id: number) => `finpath_goal_hint_seen_${id}`;

interface Props {
  profileId: number;
}

export function CorpusPrimer({ profileId }: Props) {
  const [showDialog, setShowDialog] = useState(false);
  const [showHint,   setShowHint]   = useState(false);
  const { height } = useWindowDimensions();

  useEffect(() => {
    async function check() {
      try {
        const dialogSeen = await SecureStore.getItemAsync(dialogKey(profileId));
        const hintSeen   = await SecureStore.getItemAsync(hintKey(profileId));
        if (!dialogSeen)       setShowDialog(true);
        else if (!hintSeen)    setShowHint(true);
      } catch {}
    }
    check();
  }, [profileId]);

  async function dismissDialog() {
    setShowDialog(false);
    setShowHint(true);
    try { await SecureStore.setItemAsync(dialogKey(profileId), '1'); } catch {}
  }

  async function dismissHint() {
    setShowHint(false);
    try { await SecureStore.setItemAsync(hintKey(profileId), '1'); } catch {}
  }

  return (
    <>
      {/* Explainer dialog — scrollable, screen-adaptive */}
      <Portal>
        <Dialog visible={showDialog} onDismiss={dismissDialog} style={styles.dialog}>
          <Dialog.Title style={styles.title}>How FinPath plans your retirement</Dialog.Title>
          <Dialog.ScrollArea style={[styles.scrollArea, { maxHeight: height * 0.6 }]}>
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
                <Text style={styles.emoji}>🌡️</Text>
                <View style={styles.blockText}>
                  <Text variant="labelLarge" style={styles.blockTitle}>How Inflation Shapes Your Target</Text>
                  <Text variant="bodySmall" style={styles.blockBody}>
                    Today’s ₹1 L/month becomes far more expensive by the time you retire.
                    At 6% inflation, ₹1 L today needs{" "}
                    <Text style={{ fontWeight: "700" }}>₹3.2 L/month</Text> in 20 years.
                    Your corpus must fund that real purchasing power — not today’s prices.
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

            </View>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button mode="contained" onPress={dismissDialog} style={styles.button}>
              Got it, let's plan!
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Lightbulb hint — inline card, shown after dialog dismissed, above the form */}
      {showHint && (
        <View style={styles.hintCard}>
          <Text style={styles.hintEmoji}>💡</Text>
          <Text variant="bodySmall" style={styles.hintText}>
            Start by filling in your <Text style={{ fontWeight: '700' }}>retirement age</Text> and
            {' '}<Text style={{ fontWeight: '700' }}>monthly withdrawal target</Text> below.
            The Dashboard will instantly show your required SIP and projection.
          </Text>
          <TouchableOpacity onPress={dismissHint} style={styles.hintClose} accessibilityLabel="Dismiss hint">
            <Text style={styles.hintCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  dialog:    { backgroundColor: '#FFF', borderRadius: 16 },
  title:     { fontWeight: '700', color: '#1B5E20', fontSize: 17 },
  scrollArea: { paddingHorizontal: 0 },
  content:   { paddingHorizontal: 20, paddingVertical: 8 },
  block:     { flexDirection: 'row', gap: 12, marginBottom: 18, alignItems: 'flex-start' },
  emoji:     { fontSize: 22, marginTop: 1 },
  blockText: { flex: 1 },
  blockTitle: { fontWeight: '700', color: '#1B5E20', marginBottom: 4 },
  blockBody:  { color: '#555', lineHeight: 19 },
  button:    { borderRadius: 8, marginBottom: 4, paddingHorizontal: 8 },
  // Inline hint card
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFDE7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F9A825',
  },
  hintEmoji:     { fontSize: 20, marginTop: 1 },
  hintText:      { flex: 1, color: '#444', lineHeight: 20 },
  hintClose:     { paddingLeft: 4, paddingTop: 2 },
  hintCloseText: { fontSize: 14, color: '#888', fontWeight: '700' },
});
