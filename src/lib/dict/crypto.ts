import { fromThrowable } from "neverthrow";

const ED25519_KEY_BYTES = 32;

const base64ToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const decodeBase64 = fromThrowable(base64ToBytes);

export const isEd25519Key = (value: string): boolean =>
  decodeBase64(value)
    .map((bytes) => bytes.length === ED25519_KEY_BYTES)
    .unwrapOr(false);

/** A signature that is not valid base64 does not verify. */
export const verifyEd25519 = async (
  publicKeyBase64: string,
  body: Uint8Array,
  signatureBase64: string,
): Promise<boolean> => {
  const signature = decodeBase64(signatureBase64);
  if (signature.isErr()) {
    return false;
  }
  const message = new Uint8Array(body.byteLength);
  message.set(body);
  const publicKey = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(publicKeyBase64),
    "Ed25519",
    false,
    ["verify"],
  );

  return crypto.subtle.verify(
    "Ed25519",
    publicKey,
    signature.value,
    message,
  );
};
