/**
 * Shared constants for the encrypted-payload transport. Kept in a
 * standalone module so client code can import them without dragging
 * in `node:crypto`.
 */
export const CIPHER_REQUEST_HEADER = "x-cipher-mode";
export const CIPHER_RESPONSE_HEADER = "x-cipher-mode";
export const CIPHER_MODE_AES_GCM = "aes-gcm-v1";
