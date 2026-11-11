export interface Credentials {
    id?: string;
    merchantId?: string;
    locationId?: string;
    businessName?: string;
    email?: string;
    userId?: string;
    fullName?: string;
    password?: string;
    mobileNumber?: string;
    authUserId?: string;
    devicePin?: string;
    accessToken?: string;
    refreshToken?: string;
    deviceIdentifier?: string;
    deviceType?: string;
    role?: string;
    blockUser?: boolean;
    attributes?: any;
    defaultDeviceId?: string;
    isSuperAdminAccess?: boolean;
    favoriteTables?: any;
    topicToSubscribe?: string;
    firstName?: string;
    lastName?: string;
    nickName?: string;
    address?: string;
    education?: string;
    dateOfBirth?: string;
    outlet?: any;
    userAccessInfoList?: any[];
    userAccess?: any;
    acceptCashPayment?: boolean;
    defaultFunctionalityAccessUpdated?: boolean;
    toUseNickName?: boolean;
    isTempPassword?: boolean;
    myTableViewSectionExists?: boolean;
    location_id?: string;
    access_token?: string;
    refresh_token?: string;
    staff_id?: string;
    [key: string]: any;
}

export interface MediaItem {
    id: string;
    entityType: string;
    mimeType?: string;
}

export interface BranchData {
    id?: string;
    locationId?: string;
    locationName?: string;
    name?: string;
    phoneNumber?: string;
    logoUrl?: string;
    media?: MediaItem[];
    timeZoneCd?: string;
    timeZone?: string;
    [key: string]: any;
}

export interface ReportOpts {
    locationId: string;
    startDate?: string;
    endDate?: string;
    token?: string;
    page?: number;
    size?: number;
    search?: string;
    searchQuery?: string;
    tablePageNo?: number;
    tableRecordLimit?: number;
    groupByCategory?: boolean;
    type?: string;
    eventSlug?: string;
    eventDate?: string;
    pickUpDate?: string;
    startTime?: string;
    endTime?: string;
    sortBy?: string;
    sortAsc?: boolean;
    sortOrder?: boolean | string;
    customerName?: string;
    phoneNumber?: string;
    categoryId?: string;
    paymentType?: string;
    filter?: string;
    staffId?: string;
    isToday?: boolean;
    paid?: boolean;
    reason?: string;
    considerThirdPartyValues?: string;
    [key: string]: any;
}

export class ApiError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}
