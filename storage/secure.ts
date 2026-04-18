/**
 * Encrypt-at-rest storage layer for the FIRE planner.
 *
 * Design:
 *   - 32-byte master key stored in the OS secure enclave (iOS Keychain /
 *     Android Keystore) via expo-secure-store. On web (no enclave) we fall
 *     back to localStorage; this provides obfuscation only.
 *   - Two 32-byte sub-keys are derived from the master via SHA-256 with
 *     domain-separation labels: `enc-v1` for AES, `mac-v1` for HMAC.
 *   - Each value is encrypted with AES-256-CBC (random per-record IV) and
 *     authenticated with HMAC-SHA256 over `"v2" || iv || ciphertext`.
 *   - On read we verify the MAC in constant time BEFORE decrypting, so
 *     ciphertext tampering is rejected up-front instead of leaking through
 *     padding-oracle channels.
 *
 * On-disk envelope:
 *   "v2:<base64-iv>:<base64-ciphertext>:<base64-mac>"
 *
 * Backward compat: any value that isn't a `v2:` envelope is reported as
 * `legacy-plaintext` so the caller can migrate it (then re-save encrypted).
 * We do NOT silently accept arbitrary unauthenticated formats.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import aesjs from 'aes-js';
import { Platform } from 'react-native';

const KEY_STORAGE_KEY = 'fire_planner_master_key_v1';
const KEY_BYTES = 32;
const IV_BYTES = 16;
const ENVELOPE_PREFIX = 'v2:';
const ENC_LABEL = 'enc-v1';
const MAC_LABEL = 'mac-v1';

interface DerivedKeys {
  enc: Uint8Array;
  mac: Uint8Array;
}

let cachedKeys: DerivedKeys | null = null;
let inflightKeyInit: Promise<DerivedKeys> | null = null;

// ────────────────────────── base64 helpers ──────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // btoa is available in React Native and all modern JS environments.
  if (typeof btoa === 'function') return btoa(binary);
  // Pure-JS fallback (no Buffer/Node required).
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < binary.length; i += 3) {
    const b0 = binary.charCodeAt(i), b1 = binary.charCodeAt(i + 1), b2 = binary.charCodeAt(i + 2);
    out += chars[b0 >> 2] + chars[((b0 & 3) << 4) | (b1 >> 4 || 0)]
      + (isNaN(b1) ? '=' : chars[((b1 & 15) << 2) | (b2 >> 6 || 0)])
      + (isNaN(b2) ? '=' : chars[b2 & 63]);
  }
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  // atob is available in React Native and all modern JS environments.
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  // Pure-JS fallback (no Buffer/Node required).
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const clean = b64.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let j = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)], b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)], d = lookup[clean.charCodeAt(i + 3)];
    out[j++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length) out[j++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < clean.length) out[j++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, j);
}

function utf8ToBytes(s: string): Uint8Array {
  return aesjs.utils.utf8.toBytes(s);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

// ────────────────────────── secure-store I/O ──────────────────────────

async function readMasterKey(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(KEY_STORAGE_KEY) : null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(KEY_STORAGE_KEY);
}

async function writeMasterKey(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(KEY_STORAGE_KEY, value);
    } catch {
      // localStorage disabled (private mode); accept best-effort web behavior.
    }
    return;
  }
  await SecureStore.setItemAsync(KEY_STORAGE_KEY, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}

// ────────────────────────── crypto primitives ──────────────────────────

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  // Crypto.digest accepts a BufferSource. Cast through an ArrayBuffer view to
  // satisfy the type for both web and native.
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, ab as ArrayBuffer);
  return new Uint8Array(digest);
}

/** RFC 2104 HMAC-SHA256, implemented on top of expo-crypto's SHA-256. */
async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const BLOCK = 64;
  let k = key.length > BLOCK ? await sha256(key) : key;
  if (k.length < BLOCK) {
    const padded = new Uint8Array(BLOCK);
    padded.set(k, 0);
    k = padded;
  }
  const opad = new Uint8Array(BLOCK);
  const ipad = new Uint8Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) {
    opad[i] = k[i] ^ 0x5c;
    ipad[i] = k[i] ^ 0x36;
  }
  const inner = await sha256(concat(ipad, data));
  return sha256(concat(opad, inner));
}

/** Derive 32-byte sub-key by hashing `master || label`. */
async function deriveSubKey(master: Uint8Array, label: string): Promise<Uint8Array> {
  return sha256(concat(master, utf8ToBytes(label)));
}

/** Constant-time comparison of two byte arrays. */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ────────────────────────── key management ──────────────────────────

/**
 * Returns derived enc/mac keys, generating a master key on first call.
 * Single-flight: concurrent callers share the same in-progress init promise so
 * we never generate two different master keys and lose data encrypted under
 * the discarded one.
 */
async function getDerivedKeys(): Promise<DerivedKeys> {
  if (cachedKeys) return cachedKeys;
  if (inflightKeyInit) return inflightKeyInit;
  inflightKeyInit = (async () => {
    const existing = await readMasterKey();
    let master: Uint8Array | null = null;
    if (existing) {
      try {
        const bytes = base64ToBytes(existing);
        if (bytes.length === KEY_BYTES) master = bytes;
      } catch {
        // Corrupt — regenerate.
      }
    }
    if (!master) {
      master = await Crypto.getRandomBytesAsync(KEY_BYTES);
      await writeMasterKey(bytesToBase64(master));
    }
    const [enc, mac] = await Promise.all([
      deriveSubKey(master, ENC_LABEL),
      deriveSubKey(master, MAC_LABEL),
    ]);
    cachedKeys = { enc, mac };
    return cachedKeys;
  })();
  try {
    return await inflightKeyInit;
  } finally {
    inflightKeyInit = null;
  }
}

// ────────────────────────── padding ──────────────────────────

function pkcs7Pad(bytes: Uint8Array): Uint8Array {
  const padLen = 16 - (bytes.length % 16);
  const out = new Uint8Array(bytes.length + padLen);
  out.set(bytes, 0);
  for (let i = bytes.length; i < out.length; i++) out[i] = padLen;
  return out;
}

function pkcs7Unpad(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 0 || bytes.length % 16 !== 0) throw new Error('Invalid padding');
  const padLen = bytes[bytes.length - 1];
  if (padLen < 1 || padLen > 16 || padLen > bytes.length) throw new Error('Invalid padding');
  for (let i = bytes.length - padLen; i < bytes.length; i++) {
    if (bytes[i] !== padLen) throw new Error('Invalid padding');
  }
  return bytes.subarray(0, bytes.length - padLen);
}

// ────────────────────────── encrypt / decrypt ──────────────────────────

async function encryptString(plaintext: string): Promise<string> {
  const { enc, mac } = await getDerivedKeys();
  const iv = await Crypto.getRandomBytesAsync(IV_BYTES);
  const padded = pkcs7Pad(utf8ToBytes(plaintext));
  const cbc = new aesjs.ModeOfOperation.cbc(enc, iv);
  const ct = cbc.encrypt(padded);
  const ctBytes = new Uint8Array(ct);
  // MAC binds the version label so a future format change can't be downgraded.
  const macInput = concat(utf8ToBytes(ENVELOPE_PREFIX), iv, ctBytes);
  const tag = await hmacSha256(mac, macInput);
  return `${ENVELOPE_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(ctBytes)}:${bytesToBase64(tag)}`;
}

async function decryptString(envelope: string): Promise<string> {
  if (!envelope.startsWith(ENVELOPE_PREFIX)) throw new Error('Not an encrypted envelope');
  const body = envelope.slice(ENVELOPE_PREFIX.length);
  const parts = body.split(':');
  if (parts.length !== 3) throw new Error('Malformed envelope');
  const [ivB64, ctB64, tagB64] = parts;
  const { enc, mac } = await getDerivedKeys();
  const iv = base64ToBytes(ivB64);
  const ct = base64ToBytes(ctB64);
  const tag = base64ToBytes(tagB64);
  // Verify-before-decrypt to rule out padding-oracle / tamper attacks.
  const expected = await hmacSha256(mac, concat(utf8ToBytes(ENVELOPE_PREFIX), iv, ct));
  if (!constantTimeEqual(tag, expected)) throw new Error('MAC verification failed');
  const cbc = new aesjs.ModeOfOperation.cbc(enc, iv);
  const padded = cbc.decrypt(ct);
  return aesjs.utils.utf8.fromBytes(pkcs7Unpad(new Uint8Array(padded)));
}

// ────────────────────────── public API ──────────────────────────

export type SecureReadSource = 'encrypted' | 'legacy-plaintext' | 'missing';

export interface SecureReadResult {
  value: string | null;
  source: SecureReadSource;
}

function looksLikeJson(raw: string): boolean {
  const t = raw.trimStart();
  return t.startsWith('{') || t.startsWith('[') || t.startsWith('"');
}

export async function secureSetItem(key: string, jsonString: string): Promise<void> {
  const envelope = await encryptString(jsonString);
  await AsyncStorage.setItem(key, envelope);
}

export async function secureRemoveItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

/**
 * Read a stored value with an explicit source signal so callers can decide
 * whether to migrate legacy plaintext to encrypted form.
 */
export async function secureGetItem(key: string): Promise<SecureReadResult> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return { value: null, source: 'missing' };
  if (raw.startsWith(ENVELOPE_PREFIX)) {
    try {
      const value = await decryptString(raw);
      return { value, source: 'encrypted' };
    } catch {
      return { value: null, source: 'missing' };
    }
  }
  if (looksLikeJson(raw)) return { value: raw, source: 'legacy-plaintext' };
  return { value: null, source: 'missing' };
}

/** Test/reset hook — clears the in-process cache and the persisted key. */
export async function _resetEncryptionKeyForTesting(): Promise<void> {
  cachedKeys = null;
  inflightKeyInit = null;
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(KEY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  await SecureStore.deleteItemAsync(KEY_STORAGE_KEY);
}
