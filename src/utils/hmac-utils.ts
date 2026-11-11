
import { SERVER_KNOWN_SALT } from '../constants';
import { fetchServerInfoApi } from '../services/serverInfoApi';

let ACCESS_TOKEN: any;
let hmacKey: CryptoKey | null = null;
let _derivedFromToken: string | null = null;

function getStoredCredentials() {
  try {
    const raw = localStorage.getItem("CREDENTIALS");
    if (!raw) return null;
    const stored = JSON.parse(raw);
    return stored?.credentials ?? stored ?? null;
  } catch {
    return null;
  }
}

function getStoredServerKnownSalt(): string | null {
  try {
    const stored = localStorage.getItem(SERVER_KNOWN_SALT);
    return stored && stored.trim() ? stored.trim() : null;
  } catch {
    return null;
  }
}

/** Returns the user id from stored CREDENTIALS (id ?? userId), or null if not present. */
export function getUserId(): string | null {
  try {
    const raw = localStorage.getItem('CREDENTIALS');
    if (!raw) return null;
    const stored = JSON.parse(raw);
    const c = stored?.credentials ?? stored;
    const id = c?.id ?? c?.userId ?? c?.authUserId;
    return id && typeof id === 'string' && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}
    
const encoder = new TextEncoder();
export async function deriveHmacKey(
  accessToken: string,
  serverSalt: string,
  sessionId: string,
) {
  //  Import accessToken as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(accessToken),
    "HKDF",
    false,
    ["deriveKey"],
  );

  //Derive HMAC key using HKDF
  hmacKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode(serverSalt),
      info: encoder.encode(`hmac-session-key:${sessionId}`),
    },
    keyMaterial,
    {
      name: "HMAC",
      hash: "SHA-256",
      length: 256,
    },
    false,
    ["sign", "verify"],
  );

  return hmacKey;
}

export function getSessionIdFromToken(token: string): string {
  const payload = token ? JSON.parse(atob(token?.split(".")[1])) : "";
  return payload.sid;
}

export async function signMessage(message: string) {

  if (!hmacKey) {
     throw new Error("HMAC key initialization failed");
  }
  
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    hmacKey,
    new TextEncoder().encode(message),
  );


  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function ensureHmacKey() {
  if (!hmacKey) {
    console.log("HMAC key not found, initializing...");
    await initHmac();
  }
  if (!hmacKey) {
    throw new Error("HMAC key initialization failed");
  }
}

function buildSignedMessage(payload: string, timestamp: string, nonce: string) {
  return `${payload.length}:${payload}|${timestamp}|${nonce}`;
}

export async function createRequest(data: any) {
  const payload = JSON.stringify(data);
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();

  const message = buildSignedMessage(payload, timestamp, nonce);
  await ensureHmacKey();
  const signature = await signMessage(message);

  return {
    payload,
    timestamp: Number(timestamp),
    nonce,
    signature,
  };
}

export async function createSignedHeaders(
  data: any,
  headers: Record<string, string> = {},
): Promise<Record<string, string>> {
  const { payload, timestamp, nonce, signature } = await createRequest(data);

  return {
    ...headers,
    "X-Payload": payload,
    "X-Timestamp": String(timestamp),
    "X-Nonce": nonce,
    "X-Signature": signature,
  };
}
const responseNonces = new Set();

function isNonceSeen(nonce: any) {
  if (responseNonces.has(nonce)) return true;

  responseNonces.add(nonce);

  // Prune old entries if the set grows large

  if (responseNonces.size > 1000) {
    const first = responseNonces.values().next().value;

    responseNonces.delete(first);
  }

  return false;
}
function hexToBuffer(hex: any) {
  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }

  return bytes.buffer;
}

export async function validateAndParseResponse(response: any): Promise<any> {
  const { data, dataString, timestamp, nonce, signature } = response;

  // Re-initialize key if lost (e.g. page refresh without re-login)
  if (!hmacKey) {
    await initHmac();
  }
  if (!hmacKey) {
    throw new Error("HMAC_KEY_NOT_INITIALIZED");
  }

  // Replay protection — reject duplicate nonces
  if (isNonceSeen(nonce)) {
    throw new Error("REPLAY_ATTACK_DETECTED");
  }
  const message = `${dataString.length}:${dataString}|${timestamp}|${nonce}`;
  let isValid: boolean;
  try {
    isValid = await crypto.subtle.verify(
      "HMAC",
      hmacKey,
      new Uint8Array(hexToBuffer(signature)),
      encoder.encode(message),
    );
  } catch (err) {
    throw new Error("HMAC_VERIFY_ERROR");
  }

  if (!isValid) {
    throw new Error("INVALID_SIGNATURE");
  }

  if (isValid) {
    return {
      status: 200,
      valid: true,
      data: data,
    };
  } else {
    return {
      status: 400,
      valid: false,
      message: "Validation failed",
    };
  }
}

/** Call on logout to ensure the stale key is never reused by a subsequent user. */
export function clearHmacKey() {
  hmacKey = null;
  _derivedFromToken = null;
}

export async function initHmac(overrideToken?: string) {
  const accessToken: string = overrideToken ?? (getStoredCredentials()?.accessToken as string);
  if (!accessToken) return;
  const sessionId: any = getSessionIdFromToken(accessToken);

  try {
    let serverKnownSalt: string | null = getStoredServerKnownSalt();

    if (!serverKnownSalt) {
      serverKnownSalt = await fetchServerInfoApi();
      if (serverKnownSalt) {
        localStorage.setItem(SERVER_KNOWN_SALT, serverKnownSalt);
      }
    }

    if (serverKnownSalt) {
      await deriveHmacKey(accessToken, serverKnownSalt, sessionId);
    }
  } catch {}
}

export function getauthInfo(data: any) {
  ACCESS_TOKEN = getStoredCredentials()?.accessToken;
  console.log("auth data", data);

  return data;
}
