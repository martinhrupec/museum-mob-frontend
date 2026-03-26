import apiClient, { isWeb } from './client';
import {
    SystemSettings,
    SystemSettingsUpdateData,
    Exhibition,
    ExhibitionCreateData,
    ExhibitionUpdateData,
    Position,
    PositionCreateData,
    PositionUpdateData,
    PositionListResponse,
    PositionHistory,
    PositionHistoryListResponse,
    AssignmentSnapshot,
    GuardWorkPeriod,
    GuardWorkPeriodListResponse,
    GuardDayPreference,
    GuardDayPreferenceListResponse,
    GuardExhibitionPreference,
    GuardExhibitionPreferenceListResponse,
    NonWorkingDay,
    NonWorkingDayListResponse,
    SetAvailabilityPayload,
    SetWorkPeriodsPayload,
    SetDayPreferencesPayload,
    SetExhibitionPreferencesPayload,
    GuardProfile,
    SwapRequestResponse,
    ReportLatenessResponse,
    BulkCancelResponse,
    SwapRequestWithOffers,
    AcceptSwapResponse,
    MonthlySnapshot,
    GuardWorkHistoryResponse,
    MonthlyEarningsSummaryResponse,
    MonthlyEarningsSummaryRequest,
    CreatePositionHistoryRequest,
    AdminNotification,
    AdminNotificationListResponse,
    AdminNotificationCreateData,
    AdminNotificationUpdateData,
    ReceptionReport,
    ReceptionReportListResponse,
    ReceptionReportCreateData,
    Point,
    PointListResponse,
    PointCreateData,
    AuditLogListResponse,
    AuditLogFilters,
} from '../types';

// ========================================
// AUTH ENDPOINTS
// ========================================

/**
 * Login korisnika
 * Web: session auth via /api/login/
 * Mobile: JWT auth via /token/
 */
export const login = async (username: string, password: string) => {
    if (isWeb) {
        try { await apiClient.get('/auth/check/'); } catch {}
        const response = await apiClient.post('/login/', { username, password });
        return response.data;
    }
    // Mobile JWT login
    const response = await apiClient.post('/token/', { username, password });
    return response.data; // { access, refresh }
};

/**
 * Refresh access tokena (samo mobile)
 * @param refreshToken - refresh token dobijen pri loginu
 * @returns { access: string }
 */
export const refreshAccessToken = async (refreshToken: string) => {
    const response = await apiClient.post('/token/refresh/', {
        refresh: refreshToken,
    });
    return response.data;
};

/**
 * Logout korisnika
 * Web: session logout via /api/logout/
 * Mobile: blacklistuje JWT refresh token
 */
export const logout = async (refreshToken?: string) => {
    if (isWeb) {
        // Dohvati CSRF cookie (interceptor ga pročita i pošalje kao X-CSRFToken header)
        await apiClient.get('/auth/check/');
        await apiClient.post('/logout/');
        return;
    }
    // Mobile JWT logout
    if (refreshToken) {
        await apiClient.post('/token/logout/', { refresh: refreshToken });
    }
};

/**
 * Dohvaća trenutno ulogiranog korisnika
 * @returns User objekt (AdminUser ili GuardUser)
 */
export const getCurrentUser = async () => {
    const response = await apiClient.get('/users/me/');
    return response.data;
};

// ========================================
// USER MANAGEMENT ENDPOINTS
// ========================================

/**
 * Dohvaća listu svih korisnika
 * @returns Niz korisnika (User[])
 */
export const getUsers = async (page: number = 1, filters: any = {}) => {
    const params: any = { page };
    
    // Always show inactive for admin
    params.show_inactive = filters.show_inactive !== undefined ? filters.show_inactive : true;
    
    // Role filter
    if (filters.role && filters.role !== 'all') {
        params.role = filters.role;
    }
    
    // Ordering
    if (filters.ordering) {
        params.ordering = filters.ordering;
    }
    
    const response = await apiClient.get('/users/', { params });
    return response.data;
};

/**
 * Kreira novog korisnika (samo admin)
 * @param userData - podaci o korisniku
 */
export const createUser = async (userData: {
    username: string;
    password: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    role: 'admin' | 'guard';
}) => {
    const response = await apiClient.post('/users/', userData);
    return response.data;
};

/**
 * Ažurira profil trenutnog korisnika
 * @param userData - podaci za ažuriranje
 */
export const updateUserProfile = async (userData: {
    first_name?: string;
    last_name?: string;
    email?: string;
    username?: string;
}) => {
    const response = await apiClient.patch('/users/update_profile/', userData);
    return response.data;
};

/**
 * Ažurira korisnika po ID-u (samo admin)
 * @param userId - ID korisnika
 * @param userData - podaci za ažuriranje
 */
export const updateUser = async (userId: number, userData: {
    first_name?: string;
    last_name?: string;
    email?: string;
    username?: string;
    role?: 'admin' | 'guard';
}) => {
    const response = await apiClient.patch(`/users/${userId}/`, userData);
    return response.data;
};

/**
 * Briše korisnika (samo admin)
 * @param userId - ID korisnika za brisanje
 */
export const deleteUser = async (userId: number) => {
    await apiClient.delete(`/users/${userId}/`);
};

/**
 * Mijenja lozinku trenutno ulogiranog korisnika
 * @param passwords - stara i nova lozinka
 */
export const changePassword = async (passwords: {
    old_password: string;
    new_password: string;
    new_password_confirm: string;
}) => {
    const response = await apiClient.post('/users/change_password/', passwords);
    return response.data;
};

// ========================================
// MUSEUM & EXHIBIT ENDPOINTS
// ========================================

// TODO: Dodati kad dobijem Django serializere
// export const getMuseums = async () => { ... }
// export const getExhibits = async () => { ... }

// ========================================
// SYSTEM SETTINGS ENDPOINTS
// ========================================

/**
 * Dohvaća trenutne system settings
 * @returns SystemSettings objekt
 */
export const getCurrentSystemSettings = async (): Promise<SystemSettings> => {
    const response = await apiClient.get('/system-settings/current/');
    return response.data;
};

/**
 * Ažurira system settings (samo admin)
 * @param id - ID system settings objekta
 * @param data - Podaci za ažuriranje
 * @returns Ažurirani SystemSettings objekt
 */
export const updateSystemSettings = async (
    id: number,
    data: SystemSettingsUpdateData
): Promise<SystemSettings> => {
    const response = await apiClient.patch(`/system-settings/${id}/`, data);
    return response.data;
};

// ========================================
// EXHIBITIONS ENDPOINTS
// ========================================

/**
 * Dohvaća sve izložbe
 * Guard vidi Exhibition[], Admin vidi Exhibition[] s opcionalnim poljima
 */
export const getExhibitions = async (page: number = 1, filters: any = {}) => {
    const params: any = { page };
    
    // Status filter
    if (filters.status && filters.status !== 'all') {
        params.status = filters.status;
    }
    
    // Ordering
    if (filters.ordering) {
        params.ordering = filters.ordering;
    }
    
    const response = await apiClient.get('/exhibitions/', { params });
    return response.data;
};

/**
 * Dohvaća jednu izložbu po ID-u
 */
export const getExhibition = async (id: number): Promise<Exhibition> => {
    const response = await apiClient.get(`/exhibitions/${id}/`);
    return response.data;
};

/**
 * Kreira novu izložbu (samo admin)
 */
export const createExhibition = async (data: ExhibitionCreateData): Promise<Exhibition> => {
    const response = await apiClient.post('/exhibitions/', data);
    return response.data;
};

/**
 * Ažurira izložbu (samo admin)
 */
export const updateExhibition = async (
    id: number,
    data: ExhibitionUpdateData
): Promise<Exhibition> => {
    const response = await apiClient.patch(`/exhibitions/${id}/`, data);
    return response.data;
};

/**
 * Briše izložbu (samo admin)
 */
export const deleteExhibition = async (id: number): Promise<void> => {
    await apiClient.delete(`/exhibitions/${id}/`);
};

// ========================================
// POSITIONS ENDPOINTS
// ========================================

/**
 * Dohvaća listu pozicija (paginirano)
 * @param page - broj stranice
 * @param filters - opcioni filteri (exhibition, date, is_special_event, date_after, date_before, itd.)
 */
export const getPositions = async (page: number = 1, filters: any = {}): Promise<PositionListResponse> => {
    const params = { page, ...filters };
    const response = await apiClient.get('/positions/', { params });
    return response.data;
};

/**
 * Kreira novu poziciju (samo admin)
 */
export const createPosition = async (data: PositionCreateData): Promise<Position> => {
    const response = await apiClient.post('/positions/', data);
    return response.data;
};

/**
 * Ažurira poziciju (PATCH, samo admin)
 */
export const updatePosition = async (id: number, data: PositionUpdateData): Promise<Position> => {
    const response = await apiClient.patch(`/positions/${id}/`, data);
    return response.data;
};

/**
 * Briše poziciju (samo admin)
 */
export const deletePosition = async (id: number): Promise<void> => {
    await apiClient.delete(`/positions/${id}/`);
};

// ========================================
// POSITION HISTORY ENDPOINTS
// ========================================

/**
 * Dohvaća position history (paginirano)
 * @param page - broj stranice
 * @param filters - opcioni filteri
 */
export const getPositionHistory = async (page: number = 1, filters: any = {}): Promise<PositionHistoryListResponse> => {
    const params = { page, ...filters };
    const response = await apiClient.get('/position-history/', { params });
    return response.data;
};

/**
 * Dohvaća assignment snapshot za ovaj tjedan
 */
export const getAssignmentSnapshotThisWeek = async (): Promise<AssignmentSnapshot> => {
    const response = await apiClient.get('/position-history/assigned/this-week/');
    return response.data;
};

/**
 * Dohvaća assignment snapshot za sljedeći tjedan
 */
export const getAssignmentSnapshotNextWeek = async (): Promise<AssignmentSnapshot> => {
    const response = await apiClient.get('/position-history/assigned/next-week/');
    return response.data;
};

// ========================================
// GUARD CONFIGURATION ENDPOINTS
// ========================================

/**
 * Postavlja dostupnost čuvara (available shifts)
 * @param guardId - ID guard profila
 * @param data - { available_shifts: number }
 */
export const setGuardAvailability = async (
    guardId: number,
    data: SetAvailabilityPayload
): Promise<any> => {
    const response = await apiClient.post(`/guards/${guardId}/set_availability/`, data);
    return response.data;
};

/**
 * Dohvaća radne periode čuvara (paginirano)
 * @param page - broj stranice
 * @param filters - opcioni filteri (next_week_start, guard, is_template, itd.)
 */
export const getGuardWorkPeriods = async (page: number = 1, filters: any = {}): Promise<GuardWorkPeriodListResponse> => {
    const params = { page, ...filters };
    const response = await apiClient.get('/guard-work-periods/', { params });
    return response.data;
};

/**
 * Dohvaća sve radne periode čuvara (sve stranice)
 * @param filters - opcioni filteri
 */
export const getAllGuardWorkPeriods = async (filters: any = {}): Promise<GuardWorkPeriod[]> => {
    const allResults: GuardWorkPeriod[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        const response = await getGuardWorkPeriods(page, filters);
        allResults.push(...response.results);
        hasMore = response.next !== null;
        page++;
    }
    
    return allResults;
};

/**
 * Postavlja radne periode čuvara
 * @param guardId - ID guard profila
 * @param data - { periods: [...], save_for_future_weeks: boolean }
 */
export const setGuardWorkPeriods = async (
    guardId: number,
    data: SetWorkPeriodsPayload
): Promise<any> => {
    const response = await apiClient.post(`/guards/${guardId}/set_work_periods/`, data);
    return response.data;
};

/**
 * Dohvaća preferencije za dane (paginirano)
 * @param page - broj stranice
 * @param filters - opcioni filteri (next_week_start, guard, is_template, itd.)
 */
export const getGuardDayPreferences = async (page: number = 1, filters: any = {}): Promise<GuardDayPreferenceListResponse> => {
    const params = { page, ...filters };
    const response = await apiClient.get('/guard-day-preferences/', { params });
    return response.data;
};

/**
 * Dohvaća sve preferencije za dane (sve stranice)
 * @param filters - opcioni filteri
 */
export const getAllGuardDayPreferences = async (filters: any = {}): Promise<GuardDayPreference[]> => {
    const allResults: GuardDayPreference[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        const response = await getGuardDayPreferences(page, filters);
        allResults.push(...response.results);
        hasMore = response.next !== null;
        page++;
    }
    
    return allResults;
};

/**
 * Postavlja preferencije za dane
 * @param guardId - ID guard profila
 * @param data - { day_of_week_list: [...], save_as_template?: boolean }
 */
export const setGuardDayPreferences = async (
    guardId: number,
    data: SetDayPreferencesPayload
): Promise<any> => {
    const response = await apiClient.post(`/guards/${guardId}/set_day_preferences/`, data);
    return response.data;
};

/**
 * Dohvaća preferencije za izložbe (paginirano)
 * @param page - broj stranice
 * @param filters - opcioni filteri (next_week_start, guard, is_template, itd.)
 */
export const getGuardExhibitionPreferences = async (page: number = 1, filters: any = {}): Promise<GuardExhibitionPreferenceListResponse> => {
    const params = { page, ...filters };
    const response = await apiClient.get('/guard-exhibition-preferences/', { params });
    return response.data;
};

/**
 * Dohvaća sve preferencije za izložbe (sve stranice)
 * @param filters - opcioni filteri
 */
export const getAllGuardExhibitionPreferences = async (filters: any = {}): Promise<GuardExhibitionPreference[]> => {
    const allResults: GuardExhibitionPreference[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        const response = await getGuardExhibitionPreferences(page, filters);
        allResults.push(...response.results);
        hasMore = response.next !== null;
        page++;
    }
    
    return allResults;
};

/**
 * Postavlja preferencije za izložbe
 * @param guardId - ID guard profila
 * @param data - { exhibition_ids: [...], save_as_template?: boolean }
 */
export const setGuardExhibitionPreferences = async (
    guardId: number,
    data: SetExhibitionPreferencesPayload
): Promise<any> => {
    const response = await apiClient.post(`/guards/${guardId}/set_exhibition_preferences/`, data);
    return response.data;
};

/**
 * Dohvaća neradne dane (paginirano)
 * @param page - broj stranice
 * @param filters - opcioni filteri (date, date_after, date_before, itd.)
 */
export const getNonWorkingDays = async (page: number = 1, filters: any = {}): Promise<NonWorkingDayListResponse> => {
    const params: any = { page };
    
    // In future filter
    if (filters.in_future !== undefined) {
        params.in_future = filters.in_future;
    }
    
    // Ordering
    if (filters.ordering) {
        params.ordering = filters.ordering;
    }
    
    const response = await apiClient.get('/non-working-days/', { params });
    return response.data;
};

/**
 * Dohvaća sve neradne dane (sve stranice)
 * @param filters - opcioni filteri
 */
export const getAllNonWorkingDays = async (filters: any = {}): Promise<NonWorkingDay[]> => {
    const allResults: NonWorkingDay[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        const response = await getNonWorkingDays(page, filters);
        allResults.push(...response.results);
        hasMore = response.next !== null;
        page++;
    }
    
    return allResults;
};

/**
 * Kreira novi neradni dan (samo admin)
 * @param data - podaci za kreiranje neradnog dana
 */
export const createNonWorkingDay = async (data: {
    date: string;
    is_full_day: boolean;
    non_working_shift?: 'MORNING' | 'AFTERNOON';
    reason: string;
}): Promise<NonWorkingDay> => {
    const response = await apiClient.post('/non-working-days/', data);
    return response.data;
};

/**
 * Dohvaća guard profile
 * Za admin: vraća sve guardove
 * Za guard: vraća samo njega
 * @returns Niz guard profila
 */
export const getGuards = async (): Promise<GuardProfile[]> => {
    const response = await apiClient.get('/guards/');
    console.log('getGuards raw response:', response.data);
    
    let data = response.data;
    
    // Ako je paginirano
    if (data && typeof data === 'object' && 'results' in data) {
        console.log('Paginated response, using results');
        data = data.results;
    }
    
    // Provjeri da li su Guard User objekti (sa user.guard_profile) ili direktno GuardProfile
    if (Array.isArray(data) && data.length > 0) {
        console.log('First item structure:', data[0]);
        
        // Ako objekt ima user.guard_profile strukturu, ekstrahuj guard_profile
        if (data[0].user && data[0].user.guard_profile && typeof data[0].user.guard_profile === 'object') {
            console.log('Extracting guard_profile from nested user.guard_profile');
            return data
                .map((item: any) => item.user.guard_profile)
                .filter((gp: any) => gp !== null);
        }
        
        // Alternativno, ako je direktno guard_profile na top level
        if (data[0].guard_profile && typeof data[0].guard_profile === 'object') {
            console.log('Extracting guard_profile from top level');
            return data
                .map((user: any) => user.guard_profile)
                .filter((gp: any) => gp !== null);
        }
    }
    
    console.log('Returning data as is (already GuardProfile array)');
    return data;
};

/**
 * Dohvaća dostupne dane za čuvara (za day preferences)
 * @param guardId - ID guard profila
 * @returns Lista dana (0-6) koje čuvar može raditi
 */
export const getGuardAvailableDays = async (guardId: number): Promise<number[]> => {
    const response = await apiClient.get(`/guards/${guardId}/available_days/`);
    console.log('getGuardAvailableDays raw response:', JSON.stringify(response.data));
    
    // Ako je direktno array, vrati ga
    if (Array.isArray(response.data)) {
        return response.data;
    }
    
    // Ako je objekt, pokušaj izvući array iz poznatih property-ja
    if (response.data && typeof response.data === 'object') {
        if (Array.isArray(response.data.available_days)) {
            return response.data.available_days;
        }
        if (Array.isArray(response.data.days)) {
            return response.data.days;
        }
        if (Array.isArray(response.data.day_of_week_list)) {
            return response.data.day_of_week_list;
        }
    }
    
    console.warn('getGuardAvailableDays: unexpected response format', response.data);
    return [];
};

/**
 * Dohvaća izložbe za sljedeći tjedan
 * @returns Lista aktivnih izložbi za next week
 */
export const getExhibitionsNextWeek = async (): Promise<Exhibition[]> => {
    const response = await apiClient.get('/exhibitions/next_week/');
    // Ako je paginirano
    if (response.data && typeof response.data === 'object' && 'results' in response.data) {
        return response.data.results;
    }
    return response.data;
};

// ========================================
// GUARD POSITION ACTIONS ENDPOINTS
// ========================================

/**
 * Upiši se na poziciju (assign)
 * @param positionId - ID pozicije
 */
export const assignToPosition = async (positionId: number): Promise<any> => {
    const response = await apiClient.post(`/position-history/${positionId}/assign/`, {
        action: 'ASSIGNED'
    });
    return response.data;
};

/**
 * Ispiši se ili otkaži poziciju (cancel)
 * @param positionId - ID pozicije
 */
export const cancelPosition = async (positionId: number): Promise<any> => {
    const response = await apiClient.post(`/position-history/${positionId}/cancel/`, {
        action: 'CANCEL'
    });
    return response.data;
};

/**
 * Zatraži zamjenu za poziciju
 * @param positionId - ID pozicije
 */
export const requestSwap = async (positionId: number): Promise<SwapRequestResponse> => {
    const response = await apiClient.post(`/positions/${positionId}/request_swap/`);
    return response.data;
};

/**
 * Prijavi kašnjenje
 * @param positionId - ID pozicije
 * @param estimatedDelayMinutes - procijenjeno kašnjenje u minutama (opcionalno)
 */
export const reportLateness = async (
    positionId: number,
    estimatedDelayMinutes?: number
): Promise<ReportLatenessResponse> => {
    const body = estimatedDelayMinutes !== undefined 
        ? { estimated_delay_minutes: estimatedDelayMinutes }
        : {};
    const response = await apiClient.post(`/position-history/${positionId}/report-lateness/`, body);
    return response.data;
};

/**
 * Otkaži više smjena u rasponu datuma
 * @param startDate - početni datum (YYYY-MM-DD)
 * @param endDate - krajnji datum (YYYY-MM-DD)
 */
export const bulkCancelPositions = async (
    startDate: string,
    endDate: string
): Promise<BulkCancelResponse> => {
    const response = await apiClient.post('/position-history/bulk-cancel/', {
        start_date: startDate,
        end_date: endDate
    });
    return response.data;
};

/**
 * Dohvaća sve pending swap zahtjeve dostupne trenutnom guardu
 * @returns Lista swap zahtjeva s pozicijama koje se mogu ponuditi
 */
export const getSwapRequests = async (): Promise<SwapRequestWithOffers[]> => {
    const response = await apiClient.get('/position-swap-requests/');
    return response.data;
};

/**
 * Prihvati swap zahtjev nudeći svoju poziciju
 * @param swapRequestId - ID swap zahtjeva
 * @param positionOfferedId - ID pozicije koju nudimo u zamjenu
 */
export const acceptSwapRequest = async (
    swapRequestId: number,
    positionOfferedId: number
): Promise<AcceptSwapResponse> => {
    const response = await apiClient.post(`/position-swap-requests/${swapRequestId}/accept_swap/`, {
        position_id: positionOfferedId
    });
    return response.data;
};

/**
 * Dohvaća swap zahtjeve koje je trenutni guard kreirao
 * @returns Lista swap zahtjeva tog guarda
 */
export const getMySwapRequests = async (): Promise<any[]> => {
    const response = await apiClient.get('/position-swap-requests/my_requests/');
    return response.data;
};

/**
 * Briše/poništava swap zahtjev
 * @param swapRequestId - ID swap zahtjeva
 */
export const deleteSwapRequest = async (swapRequestId: number): Promise<void> => {
    await apiClient.delete(`/position-swap-requests/${swapRequestId}/`);
};

// ========================================
// POSITION HISTORY MONTHLY ENDPOINTS
// ========================================

/**
 * Dohvaća monthly snapshot za pozicije
 * @param year - godina
 * @param month - mjesec (1-12)
 * @param guardId - 'all' ili ID čuvara
 */
export const getMonthlySnapshot = async (
    year: number,
    month: number,
    guardId: 'all' | number
): Promise<MonthlySnapshot> => {
    const response = await apiClient.get('/position-history/monthly-snapshot/', {
        params: {
            year,
            month,
            guard_id: guardId
        }
    });
    return response.data;
};

/**
 * Dohvaća work history za trenutno ulogiranog čuvara
 * @param year - godina
 * @param month - mjesec (1-12)
 */
export const getMyWorkHistory = async (
    year: number,
    month: number
): Promise<GuardWorkHistoryResponse> => {
    const response = await apiClient.get('/position-history/my-work-history/', {
        params: { year, month }
    });
    return response.data;
};

/**
 * Dohvaća monthly earnings summary za sve čuvare (admin only)
 * @param data - { month, year }
 */
export const getMonthlyEarningsSummary = async (
    data: MonthlyEarningsSummaryRequest
): Promise<MonthlyEarningsSummaryResponse> => {
    const response = await apiClient.post('/position-history/monthly-earnings-summary/', data);
    return response.data;
};

/**
 * Kreira position history zapis (admin manual assignment)
 * @param data - { position_id, guard_id, action }
 */
export const createPositionHistoryManual = async (
    data: CreatePositionHistoryRequest
): Promise<any> => {
    const response = await apiClient.post('/position-history/', data);
    return response.data;
};

// ========================================
// ADMIN NOTIFICATIONS ENDPOINTS
// ========================================

/**
 * Dohvaća sve admin notifikacije
 * Za admina vraća sve notifikacije, za guardove vraća filtrirane (relevantne za njih)
 */
export const getAdminNotifications = async (page: number = 1, filters: any = {}) => {
    const params: any = { page };
    
    // Active filter (admin only)
    if (filters.active !== undefined) {
        params.active = filters.active;
    }
    
    // Ordering
    if (filters.ordering) {
        params.ordering = filters.ordering;
    }
    
    const response = await apiClient.get('/admin-notifications/', { params });
    return response.data;
};

/**
 * Dohvaća jednu admin notifikaciju po ID-u
 */
export const getAdminNotification = async (id: number): Promise<AdminNotification> => {
    const response = await apiClient.get(`/admin-notifications/${id}/`);
    return response.data;
};

/**
 * Kreira novu admin notifikaciju (samo admin)
 */
export const createAdminNotification = async (
    data: AdminNotificationCreateData
): Promise<AdminNotification> => {
    const response = await apiClient.post('/admin-notifications/', data);
    return response.data;
};

/**
 * Ažurira admin notifikaciju (samo admin)
 */
export const updateAdminNotification = async (
    id: number,
    data: AdminNotificationUpdateData
): Promise<AdminNotification> => {
    const response = await apiClient.patch(`/admin-notifications/${id}/`, data);
    return response.data;
};

/**
 * Briše admin notifikaciju (samo admin)
 */
export const deleteAdminNotification = async (id: number): Promise<void> => {
    await apiClient.delete(`/admin-notifications/${id}/`);
};

// ========================================
// RECEPTION REPORTS ENDPOINTS
// ========================================

/**
 * Dohvaća sve reception reportove (prijave recepciji)
 * Svi korisnici (admin i guard) mogu pregledavati
 */
export const getReceptionReports = async (page: number = 1, filters: any = {}): Promise<ReceptionReportListResponse> => {
    const params: any = { page };
    
    // Exhibition filter
    if (filters.exhibition_id) {
        params.exhibition_id = filters.exhibition_id;
    }
    
    // Ordering
    if (filters.ordering) {
        params.ordering = filters.ordering;
    }
    
    const response = await apiClient.get('/reports/', { params });
    return response.data;
};

/**
 * Kreira novi reception report (samo guard)
 * Guard može kreirati report samo za pozicije koje su trenutno u tijeku
 * @param data - position_id i report_text
 */
export const createReceptionReport = async (
    data: ReceptionReportCreateData
): Promise<ReceptionReport> => {
    const response = await apiClient.post('/reports/', data);
    return response.data;
};

// ========================================
// POINTS ENDPOINTS
// ========================================

/**
 * Dohvaća sve bodove
 * Za admina vraća sve bodove, za guardove vraća samo njihove
 * @param page - broj stranice
 * @param filters - opcioni filteri (guard, ordering)
 */
export const getPoints = async (page: number = 1, filters: any = {}): Promise<PointListResponse> => {
    const params: any = { page };
    
    // Guard filter (admin only)
    if (filters.guard_id) {
        params.guard_id = filters.guard_id;
    }
    
    // Ordering
    if (filters.ordering) {
        params.ordering = filters.ordering;
    }
    
    console.log('🔍 getPoints params:', JSON.stringify(params));
    
    const response = await apiClient.get('/points/', { params });
    console.log('✅ getPoints response:', response.status, 'results:', response.data?.results?.length);
    return response.data;
};

/**
 * Kreira novi bod (samo admin)
 * @param data - { guard, points, explanation }
 */
export const createPoint = async (data: PointCreateData): Promise<Point> => {
    const response = await apiClient.post('/points/', data);
    return response.data;
};

// ========================================
// AUDIT LOG ENDPOINTS
// ========================================

/**
 * Dohvaća audit logove (povijest promjena u sustavu)
 * Samo admin ima pristup
 * @param page - broj stranice
 * @param filters - opcioni filteri (action, user_id, year, month, day, ordering)
 */
export const getAuditLogs = async (page: number = 1, filters: AuditLogFilters = {}): Promise<AuditLogListResponse> => {
    const params: any = { page };
    
    // Action filter
    if (filters.action) {
        params.action = filters.action;
    }
    
    // User filter
    if (filters.user_id) {
        params.user_id = filters.user_id;
    }
    
    // Date filters
    if (filters.year) {
        params.year = filters.year;
    }
    if (filters.month) {
        params.month = filters.month;
    }
    if (filters.day) {
        params.day = filters.day;
    }
    
    // Ordering (default: -timestamp za najnovije prvo)
    if (filters.ordering) {
        params.ordering = filters.ordering;
    }
    
    const response = await apiClient.get('/audit-logs/', { params });
    return response.data;
};