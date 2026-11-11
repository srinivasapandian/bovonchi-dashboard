const ALPHA_NUMERIC_CHAR_REGEX = /[A-Za-z0-9]/;
const ALPHABET_WITH_SPACES_REGEX = /^[A-Za-z\s]+$/;
const ALPHABET_ONLY_REGEX = /^[A-Za-z]+$/;

/**
 * Returns true when a non-empty input is made only of special characters
 * (no letters or digits after trimming).
 */
export const isOnlySpecialCharacters = (value: unknown): boolean => {
    if (typeof value !== "string") return false;
    const normalized = value.trim();
    if (!normalized) return false;
    return !ALPHA_NUMERIC_CHAR_REGEX.test(normalized);
};

/**
 * Removes everything except A-Z, a-z and spaces.
 */
export const sanitizeNameInput = (value: unknown): string => {
    if (typeof value !== "string") return "";
    return value.replace(/[^A-Za-z\s]/g, "");
};

/**
 * True only when value contains letters/spaces and has at least one letter.
 */
export const isLettersAndSpacesOnly = (value: unknown): boolean => {
    if (typeof value !== "string") return false;
    const normalized = value.trim();
    if (!normalized) return false;
    return ALPHABET_WITH_SPACES_REGEX.test(normalized);
};

/**
 * Removes everything except A-Z and a-z.
 */
export const sanitizeLettersOnlyInput = (value: unknown): string => {
    if (typeof value !== "string") return "";
    return value.replace(/[^A-Za-z]/g, "");
};

/**
 * True only when value contains letters A-Z or a-z (no spaces).
 */
export const isLettersOnly = (value: unknown): boolean => {
    if (typeof value !== "string") return false;
    const normalized = value.trim();
    if (!normalized) return false;
    return ALPHABET_ONLY_REGEX.test(normalized);
};
