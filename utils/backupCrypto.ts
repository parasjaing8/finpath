import * as Crypto from 'expo-crypto';
import aesjs from 'aes-js';

const MAGIC = 'fp-bk1';

// ── helpers ───────────────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}

function utf8(s: string): Uint8Array {
  return aesjs.utils.utf8.toBytes(s);
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes as any));
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const BLOCK = 64;
  let k = key.length > BLOCK ? await sha256(key) : key;
  if (k.length < BLOCK) { const p = new Uint8Array(BLOCK); p.set(k); k = p; }
  const opad = new Uint8Array(BLOCK);
  const ipad = new Uint8Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) { opad[i] = k[i] ^ 0x5c; ipad[i] = k[i] ^ 0x36; }
  const inner = await sha256(concat(ipad, data));
  return sha256(concat(opad, inner));
}

function pkcs7Pad(bytes: Uint8Array): Uint8Array {
  const padLen = 16 - (bytes.length % 16);
  const out = new Uint8Array(bytes.length + padLen);
  out.set(bytes);
  for (let i = bytes.length; i < out.length; i++) out[i] = padLen;
  return out;
}

function pkcs7Unpad(bytes: Uint8Array): Uint8Array {
  const padLen = bytes[bytes.length - 1];
  if (padLen < 1 || padLen > 16) throw new Error('Invalid padding');
  return bytes.subarray(0, bytes.length - padLen);
}

// ── public API ────────────────────────────────────────────────────────────

export function isEncryptedBackup(text: string): boolean {
  try { return JSON.parse(text)?.v === MAGIC; } catch { return false; }
}

export async function encryptBackup(jsonString: string, passphrase: string): Promise<string> {
  const salt = await Crypto.getRandomBytesAsync(16);
  const iv = await Crypto.getRandomBytesAsync(16);
  const pw = utf8(passphrase);
  const encKey = await sha256(concat(pw, salt, utf8('enc')));
  const macKey = await sha256(concat(pw, salt, utf8('mac')));
  const padded = pkcs7Pad(utf8(jsonString));
  const ct = new Uint8Array(new aesjs.ModeOfOperation.cbc(encKey, iv).encrypt(padded));
  const tag = await hmac(macKey, concat(utf8(MAGIC), salt, iv, ct));
  return JSON.stringify({ v: MAGIC, salt: bytesToBase64(salt), iv: bytesToBase64(iv), ct: bytesToBase64(ct), mac: bytesToBase64(tag) });
}

export async function decryptBackup(text: string, passphrase: string): Promise<string> {
  const obj = JSON.parse(text);
  if (obj?.v !== MAGIC) throw new Error('Not an encrypted backup');
  const salt = base64ToBytes(obj.salt);
  const iv = base64ToBytes(obj.iv);
  const ct = base64ToBytes(obj.ct);
  const mac = base64ToBytes(obj.mac);
  const pw = utf8(passphrase);
  const encKey = await sha256(concat(pw, salt, utf8('enc')));
  const macKey = await sha256(concat(pw, salt, utf8('mac')));
  const expected = await hmac(macKey, concat(utf8(MAGIC), salt, iv, ct));
  if (mac.length !== expected.length) throw new Error('Wrong passphrase or corrupt backup');
  let diff = 0;
  for (let i = 0; i < mac.length; i++) diff |= mac[i] ^ expected[i];
  if (diff !== 0) throw new Error('Wrong passphrase or corrupt backup');
  const padded = new Uint8Array(new aesjs.ModeOfOperation.cbc(encKey, iv).decrypt(ct));
  return aesjs.utils.utf8.fromBytes(pkcs7Unpad(padded));
}
