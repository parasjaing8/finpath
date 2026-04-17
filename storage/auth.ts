/**
 * PIN + biometric credential storage.
 *
 * The user's PIN is never stored in plaintext. We persist:
 *   - a 16-byte random salt (per-install)
 *   - SHA-256(salt || utf8(pin)) as a hex string
 * On verify we recompute and constant-time compare. Both fields live inside
 * the encrypted storage layer (`secureSetItem`) so they're encrypted on disk
 * AND only decryptable with the master key in the OS secure enclave.
 *
 * `biometricEnabled` is just a user preference flag; the actual biometric
 * prompt happens at unlock time via `expo-local-authentication`.
 */

import * as Crypto from 'expo-crypto';
import * as LocalAuth from 'expo-local-authentication';
import { Platform } from 'react-native';
import { secureGetItem, secureSetItem } from './secure';

const CREDS_KEY = '@fire_credentials_v1';
const SALT_BYTES = 16;

interface StoredCredentials {
  salt: string;            // base64
  pinHashHex: string;      // sha256 hex of (salt || pin)
  biometricEnabled: boolean;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
}

async function hashPin(salt: string, pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function setCredentials(pin: string, biometricEnabled: boolean): Promise<void> {
  const saltBytes = await Crypto.getRandomBytesAsync(SALT_BYTES);
  const salt = bytesToBase64(saltBytes);
  const pinHashHex = await hashPin(salt, pin);
  const payload: StoredCredentials = { salt, pinHashHex, biometricEnabled };
  await secureSetItem(CREDS_KEY, JSON.stringify(payload));
}

export async function getCredentials(): Promise<StoredCredentials | null> {
  const { value } = await secureGetItem(CREDS_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as StoredCredentials;
  } catch {
    return null;
  }
}

export async function hasCredentials(): Promise<boolean> {
  return (await getCredentials()) !== null;
}

export async function verifyPin(pin: string): Promise<boolean> {
  const creds = await getCredentials();
  if (!creds) return false;
  const candidate = await hashPin(creds.salt, pin);
  // Constant-time compare on hex strings.
  if (candidate.length !== creds.pinHashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ creds.pinHashHex.charCodeAt(i);
  }
  return diff === 0;
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  const creds = await getCredentials();
  if (!creds) return;
  await secureSetItem(CREDS_KEY, JSON.stringify({ ...creds, biometricEnabled: enabled }));
}

export async function isBiometricSupported(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const [hasHw, isEnrolled] = await Promise.all([
      LocalAuth.hasHardwareAsync(),
      LocalAuth.isEnrolledAsync(),
    ]);
    return hasHw && isEnrolled;
  } catch {
    return false;
  }
}

export async function promptBiometric(reason = 'Unlock FinPath'): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const result = await LocalAuth.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
