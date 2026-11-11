import { axiosFetch as authFetch } from './axiosFetch';
import { parseResponse } from './crypto';
import { ApiError } from '../types/api';
import { createRequest, createSignedHeaders, getUserId } from '../utils/hmac-utils';

const BASE_URL = process.env.REACT_APP_API_ENDPOINT || '';

function buildAuthHeaders(token?: string | null): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-source': 'MP',
    };
    if (token && typeof token === 'string' && token.trim()) {
        headers['Authorization'] = `Bearer ${token.trim()}`;
    }
    return headers;
}

async function signedGetRequest<T>(
    url: string,
    hmacData: Record<string, any>,
    token: string | null | undefined,
    parse: (response: Response) => Promise<T>,
    fallbackMessage: string,
): Promise<T> {
    const headers = await createSignedHeaders(hmacData, buildAuthHeaders(token));
    const response = await authFetch(url, { headers });
    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        let errMsg = fallbackMessage;
        try { errMsg = JSON.parse(errText)?.message || errMsg; } catch { /* ignore */ }
        throw new Error(errMsg);
    }
    return parse(response);
}

export const loginApi = async ({ businessName, userId, password }: { businessName: string; userId: string; password: string }) => {
    const response = await fetch(`${BASE_URL}/merchants/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, userId, password }),
    });
    const text = await response.text();
    const raw = parseResponse(text);
    const meta = raw?.metaDataInfo;
    if (meta?.responseCode === 'ERROR') {
        throw new Error(meta.responseMessage || 'Your User ID or Password is Incorrect');
    }
    if (!response.ok) {
        throw new Error(raw?.message || meta?.responseMessage || 'Your User ID or Password is Incorrect');
    }
    // CREDENTIALS = only the inner data object (id, merchantId, accessToken, ...). Never store metaDataInfo, content, or wrapper.
    const CREDENTIAL_KEYS = [
        'id', 'merchantId', 'locationId', 'businessName', 'email', 'userId', 'fullName', 'password', 'mobileNumber',
        'authUserId', 'devicePin', 'accessToken', 'refreshToken', 'deviceIdentifier', 'deviceType', 'role', 'blockUser',
        'attributes', 'defaultDeviceId', 'isSuperAdminAccess', 'favoriteTables', 'topicToSubscribe', 'firstName', 'lastName',
        'nickName', 'address', 'education', 'dateOfBirth', 'outlet', 'userAccessInfoList', 'userAccess', 'acceptCashPayment',
        'defaultFunctionalityAccessUpdated', 'toUseNickName', 'isTempPassword', 'myTableViewSectionExists',
        'location_id', 'access_token', 'refresh_token', 'staff_id',
    ];
    const from = raw?.metaDataInfo?.data ?? raw?.data ?? raw?.credentials ?? (Array.isArray(raw?.content) ? raw.content[0] : raw?.content) ?? raw;
    if (!from || typeof from !== 'object') return raw;
    const credentials: Record<string, any> = {};
    for (const key of CREDENTIAL_KEYS) {
        if (Object.prototype.hasOwnProperty.call(from, key)) credentials[key] = from[key];
    }
    if (from.access_token && !credentials.accessToken) credentials.accessToken = from.access_token;
    if (from.refresh_token && !credentials.refreshToken) credentials.refreshToken = from.refresh_token;
    if (from.location_id && !credentials.locationId) credentials.locationId = from.location_id;
    return Object.keys(credentials).length ? credentials : raw;
};

// Match maghil-portal: get staff's locations (branch list for switch)
export const getStaffLocations = async (staffId: string, token: string | null) => {
    return signedGetRequest(
        `${BASE_URL}/staff/${staffId}/locations`,
        { staffId },
        token,
        async (response) => parseResponse(await response.text()),
        'Failed to fetch locations',
    );
};

// Match maghil-portal: get location/branch details (branch list, logo) for branch switch
export const getLocationDetails = async (locationId: string, token: string | null) => {
    return signedGetRequest(
        `${BASE_URL}/merchants/location/${locationId}/details`,
        { locationId },
        token,
        async (response) => parseResponse(await response.text()),
        'Failed to fetch location details',
    );
};
