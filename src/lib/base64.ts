/** `String.fromCharCode` takes its characters as arguments, which a whole file would overflow. */
const BASE64_CHUNK = 0x8000

export const toBase64 = (bytes: Uint8Array): string => {
  let binary = ""
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(start, start + BASE64_CHUNK))
  }
  return btoa(binary)
}
