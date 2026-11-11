import CryptoJS from 'crypto-js';

// Base decryption logic
export const handleDecrypt = (dataToDecrypt: string): string => {
    const secretKey = process.env.REACT_APP_E_KEY || '';
    const utf8SecretKey = CryptoJS.enc.Utf8.parse(secretKey);
    const decrypted = CryptoJS.AES.decrypt(dataToDecrypt, utf8SecretKey, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
    }).toString(CryptoJS.enc.Utf8);
    return decrypted;
};

// Decrypt a JSON-encoded encrypted string → parsed object
export const decryptJson = <T = any>(json: string): T | null => {
    if (!json) return null;
    const decryptedJson = handleDecrypt(json);
    return JSON.parse(decryptedJson);
};

// Encrypt a plain string
export const handleEncrypt = (dataToEncrypt: string): string => {
    const secretKey = process.env.REACT_APP_E_KEY || '';
    const utf8SecretKey = CryptoJS.enc.Utf8.parse(secretKey);
    const utf8DataToEncrypt = CryptoJS.enc.Utf8.parse(dataToEncrypt);
    const encrypted = CryptoJS.AES.encrypt(utf8DataToEncrypt, utf8SecretKey, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
    }).toString();
    return encrypted;
};

// Encrypt a JSON object → encrypted string
export const encryptJson = (json: Record<string, any>): string => {
    return handleEncrypt(JSON.stringify(json));
};

/**
 * Smart response parser:
 * 1. If response body is { encryptedText: "..." } → unwrap and decrypt
 * 2. If response body is a JSON-quoted encrypted string → strip quotes, decrypt
 * 3. If response body is a raw encrypted string → decrypt directly
 * 4. If decryption fails → try plain JSON parse
 */
export const parseResponse = (text: string): any => {
    if (!text) return null;

    // Step 1: Try to parse outer JSON to check for { encryptedText: "..." } wrapper
    let outerParsed: any = null;
    try { outerParsed = JSON.parse(text); } catch { /* not JSON */ }

    if (outerParsed && typeof outerParsed === 'object' && typeof outerParsed.encryptedText === 'string') {
        // Unwrap the encrypted payload and decrypt it
        try {
            return decryptJson(outerParsed.encryptedText);
        } catch {
            // Decryption failed – return whatever we can
            return outerParsed;
        }
    }

    // Step 2: Handle JSON-quoted strings like: "U2FsdGVkX1+..."
    const raw = text.startsWith('"') ? JSON.parse(text) : text;

    // Step 3: Try direct decryption
    try {
        return decryptJson(raw);
    } catch {
        // Step 4: Fall back to plain JSON or raw text
        try {
            return outerParsed ?? JSON.parse(text);
        } catch {
            return text;
        }
    }
};
