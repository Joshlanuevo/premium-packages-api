import sodium from "libsodium-wrappers";

export async function unhash(encrypted: string): Promise<string | null> {
  if (!encrypted) {
    return null;
  }

  try {
    await sodium.ready;

    const secret = await getSecretKey();
    const key = sodium.from_hex(secret);
    const nonce = sodium.from_hex(encrypted.substring(0, 48));
    const ciphertext = sodium.from_hex(encrypted.substring(48));

    const decrypted = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
    return decrypted ? sodium.to_string(decrypted) : encrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    return encrypted;
  }
}

export async function hash(value: string): Promise<string | null> {
  if (!value) {
    return null;
  }

  try {
    await sodium.ready;

    const secret = await getSecretKey();
    const key = sodium.from_hex(secret);
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const message = sodium.from_string(value);

    const ciphertext = sodium.crypto_secretbox_easy(message, nonce, key);
    const nonceHex = sodium.to_hex(nonce);
    const ciphertextHex = sodium.to_hex(ciphertext);

    return nonceHex + ciphertextHex;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Encryption failed");
  }
}

async function getSecretKey(): Promise<string> {
  const secretKey = process.env.VITE_APP_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Secret key not found in environment variables");
  }
  return secretKey;
}