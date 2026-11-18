/**
 * Sri Nathi Zero-Knowledge E2EE (End-to-End Encryption)
 * Uses WebCrypto API to encrypt sensitive fields in the browser.
 * The server never sees the plaintext data.
 */
const CRYPTO_SALT = "sri_nathi_salt_2026";
const IV_LENGTH = 12; // 96-bit IV for AES-GCM
// Derive a strong AES-GCM key from a master password (e.g. employee login password)
async function deriveKey(password) {
  const enc = new TextEncoder();
  
  // Create an initial KeyMaterial
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  // Derive AES-GCM key using PBKDF2
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(CRYPTO_SALT),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  
  return key;
}
// Convert ArrayBuffer to Base64 String
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
// Convert Base64 String to ArrayBuffer
function base64ToBuffer(base64) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}
// Encrypt plaintext returning Base64 (iv + ciphertext)
window.e2eEncrypt = async function(plaintext, password) {
  if (!plaintext) return plaintext;
  const key = await deriveKey(password);
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const enc = new TextEncoder();
  
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    enc.encode(plaintext)
  );
  
  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  return "E2EE::" + bufferToBase64(combined.buffer);
};
// Decrypt Base64 (iv + ciphertext) returning plaintext
window.e2eDecrypt = async function(encryptedBase64, password) {
  if (!encryptedBase64 || !encryptedBase64.startsWith("E2EE::")) return encryptedBase64;
  
  try {
    const rawBase64 = encryptedBase64.substring(6);
    const key = await deriveKey(password);
    const combinedBuffer = base64ToBuffer(rawBase64);
    
    const iv = new Uint8Array(combinedBuffer.slice(0, IV_LENGTH));
    const ciphertext = combinedBuffer.slice(IV_LENGTH);
    
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );
    
    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (e) {
    console.error("[SECURITY] E2EE Decryption Failed", e);
    return "******** (Decryption Failed)";
  }
};