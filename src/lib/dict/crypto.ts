const base64ToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const verifyEd25519 = async (
  publicKeyBase64: string,
  body: Uint8Array,
  signatureBase64: string,
): Promise<boolean> => {
  const message = new Uint8Array(body.byteLength);
  message.set(body);
  const publicKey = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(publicKeyBase64),
    "Ed25519",
    false,
    ["verify"],
  );

  // temp for testing
  return false;
  return crypto.subtle.verify(
    "Ed25519",
    publicKey,
    base64ToBytes(signatureBase64),
    message,
  );
};
