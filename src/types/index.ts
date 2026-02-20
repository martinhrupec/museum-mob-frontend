// ========================================
// USER TYPES
// ========================================

export type UserRole = 'admin' | 'guard';

/**
 * Guard profil - samo guard korisnici imaju
 */
export interface GuardProfile {
  id: number;
  username: string;
  full_name: string;
  is_active: boolean;
  priority_number: string; // Decimal kao string
  availability: number | null;
  availability_updated_at: string | null; // ISO datetime
}

/**
 * Base User interface - zajednička polja za sve korisnike
 */
interface BaseUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  date_joined: string;
  last_login: string | null; // Web (session) login
  last_mobile_login: string | null; // Mobile (JWT) login
  
  // Dodatna polja koja SAMO admin vidi
  is_staff?: boolean;
  is_superuser?: boolean;
  updated_at?: string;
}

/**
 * Guard korisnik - ima guard_profile
 */
export interface GuardUser extends BaseUser {
  role: 'guard';
  guard_profile: GuardProfile;
}

/**
 * Admin korisnik - nema guard_profile (null)
 */
export interface AdminUser extends BaseUser {
  role: 'admin';
  guard_profile: null;
}

/**
 * Union type - User može biti ili Guard ili Admin
 * TypeScript automatski prepoznaje tip na osnovu 'role' polja
 */
export type User = GuardUser | AdminUser;

// ========================================
// AUTH TYPES
// ========================================

/**
 * Response od /api/login/ endpointa
 */
export interface LoginResponse {
  access: string;
  refresh: string;
}

/**
 * Response od /api/refresh/ endpointa
 */
export interface RefreshResponse {
  access: string;
}

// ========================================
// EXHIBITION TYPES
// ========================================

/**
 * Statistika pozicija - SAMO admin vidi
 */
export interface PositionStats {
  total_positions: number;
  required_positions: number;
  assigned_positions: number;
  cancelled_positions: number;
  unassigned_positions: number;
  assignment_rate: number;
}

/**
 * Statistika guardova - SAMO admin vidi
 */
export interface GuardStats {
  unique_guards_assigned: number;
  total_assignments: number;
}

/**
 * Exhibition - guard i admin vide većinu polja
 */
export interface Exhibition {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  open_on: number[]; // Dani u tjednu (0-6)
  status: 'active' | 'upcoming' | 'finished'; // Automatski se računa prema datumima
  duration_days: number;
  number_of_positions: number;
  is_special_event: boolean;
  event_start_time: string | null;
  event_end_time: string | null;
  rules: string;
  position_count: number; // Ukupan broj pozicija za cijelu izložbu
  assigned_positions: number; // Broj dodijeljenih pozicija
  created_at: string;
  updated_at: string;
  
  // Opciona polja - SAMO admin vidi
  position_stats?: PositionStats;
  guard_stats?: GuardStats;
}

// ========================================
// API RESPONSE TYPES (sa paginacijom)
// ========================================

/**
 * Generički tip za paginirane liste (Django REST Framework default)
 */
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Lista korisnika sa paginacijom
 */
export type UserListResponse = PaginatedResponse<User>;

/**
 * Lista ekshibicija sa paginacijom
 */
export type ExhibitionListResponse = PaginatedResponse<Exhibition>;

// ========================================
// SYSTEM SETTINGS TYPES
// ========================================

/**
 * Timing window struktura za config i manual assignment
 */
export interface TimingWindow {
  start: {
    day: number;
    day_label: string;
    time: string;
  };
  end: {
    day: number;
    day_label: string;
    time: string;
  };
}

/**
 * Automated assignment timing
 */
export interface AutomatedAssignmentTiming {
  publish: {
    day: number;
    day_label: string;
    time: string;
  };
}

/**
 * Svi timing windows
 */
export interface TimingWindows {
  config: TimingWindow;
  automated_assignment: AutomatedAssignmentTiming;
  manual_assignment: TimingWindow;
  grace_period: TimingWindow;
}

/**
 * System Settings - globalne postavke sustava
 */
export interface SystemSettings {
  id: number;
  workdays: number[]; // Radni dani (0-6)
  this_week_start: string;
  this_week_end: string;
  next_week_start: string;
  next_week_end: string;
  day_for_assignments: number;
  time_of_assignments: string;
  config_start_day: number;
  config_start_time: string;
  config_end_day: number;
  config_end_time: string;
  manual_assignment_day: number;
  manual_assignment_time: string;
  manual_assignment_end_day: number;
  manual_assignment_end_time: string;
  grace_period_start_day: number;
  grace_period_start_time: string;
  grace_period_end_day: number;
  grace_period_end_time: string;
  timing_windows: TimingWindows;
  points_life_weeks: number;
  minimal_number_of_positions_in_week: number;
  award_for_position_completion: string;
  award_for_sunday_position_completion: string;
  award_for_jumping_in_on_cancelled_position: string;
  penalty_for_being_late_with_notification: string;
  penalty_for_being_late_without_notification: string;
  penalty_for_position_cancellation_on_the_position_day: string;
  penalty_for_position_cancellation_before_the_position_day: string;
  penalty_for_assigning_less_then_minimal_positions: string;
  hourly_rate: string;
  weekday_morning_start: string;
  weekday_morning_end: string;
  weekday_afternoon_start: string;
  weekday_afternoon_end: string;
  weekend_morning_start: string;
  weekend_morning_end: string;
  weekend_afternoon_start: string;
  weekend_afternoon_end: string;
  created_at: string;
  updated_by: number | null;
  is_active: boolean;
}

/**
 * Podaci koje admin može mijenjati
 */
export interface SystemSettingsUpdateData {
  workdays?: number[];
  points_life_weeks?: number;
  award_for_position_completion?: string;
  award_for_sunday_position_completion?: string;
  award_for_jumping_in_on_cancelled_position?: string;
  penalty_for_being_late_with_notification?: string;
  penalty_for_being_late_without_notification?: string;
  penalty_for_position_cancellation_on_the_position_day?: string;
  penalty_for_position_cancellation_before_the_position_day?: string;
  penalty_for_assigning_less_then_minimal_positions?: string;
  hourly_rate?: string;
  weekday_morning_start?: string;
  weekday_morning_end?: string;
  weekday_afternoon_start?: string;
  weekday_afternoon_end?: string;
  weekend_morning_start?: string;
  weekend_morning_end?: string;
  weekend_afternoon_start?: string;
  weekend_afternoon_end?: string;
}

/**
 * Create Exhibition Data
 */
export interface ExhibitionCreateData {
  name: string;
  number_of_positions: number;
  start_date: string; // ISO datetime
  end_date: string; // ISO datetime
  open_on: number[];
  rules?: string;
  is_special_event?: boolean;
  event_start_time?: string | null;
  event_end_time?: string | null;
}

/**
 * Update Exhibition Data
 */
export interface ExhibitionUpdateData extends Partial<ExhibitionCreateData> {}

// ========================================
// POSITION TYPES
// ========================================

/**
 * Jedna pozicija (Position)
 */
export interface Position {
  id: number;
  exhibition: number; // foreign key id
  exhibition_name: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm:ss
  end_time: string; // HH:mm:ss
  is_special_event: boolean;
}

/**
 * Kreiranje pozicije (POST)
 */
export interface PositionCreateData {
  exhibition_id: number;
  date: string; // YYYY-MM-DD
  start_time: string; // ISO string ili HH:mm:ss
  end_time: string; // ISO string ili HH:mm:ss
  is_special_event?: boolean;
}

/**
 * Update pozicije (PATCH)
 */
export interface PositionUpdateData extends Partial<PositionCreateData> {}

/**
 * Lista pozicija sa paginacijom
 */
export type PositionListResponse = PaginatedResponse<Position>;

// ========================================
// POSITION HISTORY TYPES
// ========================================

/**
 * Guard info u position history (malo drugačiji od GuardProfile)
 */
export interface PositionHistoryGuard {
  id: number; // ID guard_profile-a, ne user-a
  username: string;
  full_name: string;
  is_active: boolean;
  priority_number: string; // Decimal kao string
}

/**
 * Position History - historija akcija nad pozicijom
 */
export interface PositionHistory {
  id: number;
  position: Position;
  guard: PositionHistoryGuard;
  action: string; // npr. "ASSIGNED", "CANCELLED", itd.
  action_time: string; // ISO datetime
}

/**
 * Lista position history sa paginacijom
 */
export type PositionHistoryListResponse = PaginatedResponse<PositionHistory>;

// ========================================
// ASSIGNMENT SNAPSHOT TYPES (weekly view)
// ========================================

/**
 * Pozicija unutar weekly assignment snapshot-a
 */
export interface AssignmentPosition {
  position: Position;
  guard: PositionHistoryGuard | null;
  is_taken: boolean;
  last_action: string; // "empty", "ASSIGNED", "CANCELLED", itd.
  last_action_time: string | null; // ISO datetime
}

/**
 * Weekly assignment snapshot (this-week / next-week)
 */
export interface AssignmentSnapshot {
  week_start: string; // YYYY-MM-DD
  week_end: string; // YYYY-MM-DD
  positions: AssignmentPosition[];
}

// ========================================
// GUARD CONFIGURATION TYPES
// ========================================

/**
 * Guard Work Period - radni periodi čuvara
 */
export interface GuardWorkPeriod {
  id: number;
  guard: number;
  day_of_week: number; // 0-6 (0 = Monday in Django convention, ili Sunday depending on backend)
  shift_type: 'morning' | 'afternoon';
  is_template: boolean;
  next_week_start: string | null; // YYYY-MM-DD
  created_at: string;
}

/**
 * Lista work perioda sa paginacijom
 */
export type GuardWorkPeriodListResponse = PaginatedResponse<GuardWorkPeriod>;

/**
 * Guard Day Preference - preferencije za dane
 */
export interface GuardDayPreference {
  id: number;
  guard: GuardProfile;
  day_order: number[]; // Poredani dani po prioritetu
  is_template: boolean;
  next_week_start: string | null;
  created_at: string;
}

/**
 * Lista day preferencija sa paginacijom
 */
export type GuardDayPreferenceListResponse = PaginatedResponse<GuardDayPreference>;

/**
 * Guard Exhibition Preference - preferencije za izložbe
 */
export interface GuardExhibitionPreference {
  id: number;
  guard: GuardProfile;
  exhibition_order: number[]; // Poredani ID-evi izložbi po prioritetu
  is_template: boolean;
  next_week_start: string | null;
  created_at: string;
}

/**
 * Lista exhibition preferencija sa paginacijom
 */
export type GuardExhibitionPreferenceListResponse = PaginatedResponse<GuardExhibitionPreference>;

/**
 * Non-Working Day - neradni dani
 */
export interface NonWorkingDay {
  id: number;
  date: string; // YYYY-MM-DD
  is_full_day: boolean;
  non_working_shift: 'MORNING' | 'AFTERNOON' | null;
  reason: string;
  created_by: number;
  created_by_username: string;
  created_at: string;
}

/**
 * Lista neradnih dana sa paginacijom
 */
export type NonWorkingDayListResponse = PaginatedResponse<NonWorkingDay>;

/**
 * Payload za set_availability
 */
export interface SetAvailabilityPayload {
  available_shifts: number;
}

/**
 * Payload za set_work_periods
 */
export interface SetWorkPeriodsPayload {
  periods: Array<{
    day_of_week: number;
    shift_type: 'morning' | 'afternoon';
  }>;
  save_for_future_weeks: boolean;
}

/**
 * Payload za set_day_preferences
 */
export interface SetDayPreferencesPayload {
  day_of_week_list: number[];
  save_as_template?: boolean;
}

/**
 * Payload za set_exhibition_preferences
 */
export interface SetExhibitionPreferencesPayload {
  exhibition_ids: number[];
  save_as_template?: boolean;
}

/**
 * Guard availability info (extended guard profile)
 */
export interface GuardWithAvailability extends GuardProfile {
  available_shifts?: number;
}

// ========================================
// GUARD POSITION ACTION TYPES
// ========================================

/**
 * Akcije koje guard može izvršiti na poziciji
 */
export type PositionAction = 
  | 'assign'      // Upiši se
  | 'unassign'    // Ispiši se (next week, manual period)
  | 'cancel'      // Otkaži (this week)
  | 'request_swap' // Zatraži zamjenu
  | 'report_lateness' // Prijavi kašnjenje
  | 'bulk_cancel' // Otkaži više smjena
  | 'challenge';  // Izazovi na dvoboj (disabled)

/**
 * Swap request details
 */
export interface SwapRequest {
  id: number;
  requesting_guard: number;
  requesting_guard_name: string;
  position_to_swap: number;
  position_to_swap_details: {
    id: number;
    exhibition: number;
    exhibition_name: string;
    date: string;
    start_time: string;
    end_time: string;
    is_special_event: boolean;
  };
  status: 'pending' | 'accepted' | 'cancelled' | 'expired';
  accepted_by_guard: number | null;
  accepted_by_guard_name: string | null;
  position_offered_in_return: number | null;
  position_offered_details: any | null;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

/**
 * Response od request_swap endpointa
 */
export interface SwapRequestResponse {
  message: string;
  swap_request: SwapRequest;
}

/**
 * Response od report-lateness endpointa
 */
export interface ReportLatenessResponse {
  message: string;
  penalty_applied: {
    points: number;
    explanation: string;
  };
  notification_created: {
    id: number;
    title: string;
  };
}

/**
 * Response od bulk-cancel endpointa
 */
export interface BulkCancelResponse {
  message: string;
  cancelled_count: number;
  penalty_applied: number;
  positions: Array<{
    id: number;
    exhibition: string;
    date: string;
    start_time: string;
  }>;
}

/**
 * Pozicija koju guard može ponuditi u zamjenu
 */
export interface OfferablePosition {
  id: number;
  exhibition: number;
  exhibition_name: string;
  date: string;
  start_time: string;
  end_time: string;
  is_special_event: boolean;
}

/**
 * Swap request s pozicijama koje se mogu ponuditi
 */
export interface SwapRequestWithOffers {
  swap_request: SwapRequest;
  positions_can_offer: OfferablePosition[];
}

/**
 * Response od accept swap endpointa
 */
export interface AcceptSwapResponse {
  message: string;
  swap_request: SwapRequest;
}

// ========================================
// MONTHLY SNAPSHOT TYPES (position history)
// ========================================

/**
 * Guard info u monthly snapshot
 */
export interface MonthlySnapshotGuard {
  id: number;
  username: string;
  full_name: string;
  is_active: boolean;
  priority_number: string;
  availability: number | null;
  availability_updated_at: string | null;
}

/**
 * Pozicija unutar monthly snapshot-a
 */
export interface MonthlySnapshotPosition {
  position: Position;
  guard: MonthlySnapshotGuard | null;
  is_taken: boolean;
  last_action: string; // "empty", "ASSIGNED", "CANCELED", etc.
  last_action_time: string | null;
  position_history_id: number | null;
}

/**
 * Monthly snapshot response
 */
export interface MonthlySnapshot {
  month: number;
  year: number;
  period_start: string;
  period_end: string;
  filter_guard_id: number | null;
  total_positions: number;
  positions: MonthlySnapshotPosition[];
}

// ========================================
// GUARD WORK HISTORY TYPES
// ========================================

/**
 * Pojedinačna pozicija u work history
 */
export interface WorkHistoryPosition {
  id: number;
  exhibition: string;
  date: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  base_hourly_rate: number;
  hourly_rate: number;
  is_sunday: boolean;
  earnings: number;
}

/**
 * Sumarna statistika zarade
 */
export interface WorkHistorySummary {
  total_positions: number;
  total_hours: number;
  total_earnings: number;
}

/**
 * Guard work history response
 */
export interface GuardWorkHistoryResponse {
  period: string;
  guard: {
    id: number;
    username: string;
    full_name: string;
  };
  summary: WorkHistorySummary;
  positions: WorkHistoryPosition[];
}

// ========================================
// MONTHLY EARNINGS SUMMARY TYPES (admin)
// ========================================

/**
 * Izložba u earnings breakdown
 */
export interface EarningsExhibition {
  exhibition_id: number;
  name: string;
  hours: number;
  earnings: number;
}

/**
 * Guard u monthly earnings summary
 */
export interface MonthlyEarningsGuard {
  guard_id: number;
  username: string;
  full_name: string;
  total_hours: number;
  total_earnings: number;
  exhibitions: EarningsExhibition[];
}

/**
 * Monthly earnings summary response
 */
export interface MonthlyEarningsSummaryResponse {
  month: number;
  year: number;
  period_start: string;
  period_end: string;
  summary: {
    total_guards: number;
    total_hours: number;
    total_earnings: number;
  };
  guards: MonthlyEarningsGuard[];
}

/**
 * Request payload za monthly earnings summary
 */
export interface MonthlyEarningsSummaryRequest {
  month: number;
  year: number;
}

/**
 * Request payload za create position history (admin)
 */
export interface CreatePositionHistoryRequest {
  position_id: number;
  guard_id: number;
  action: 'ASSIGNED' | 'CANCELED';
}

// ========================================
// ADMIN NOTIFICATION TYPES
// ========================================

/**
 * Tip notifikacije: broadcast (svima), multicast (nekima po uvjetima), unicast (jednom korisniku)
 */
export type AdminNotificationCastType = 'broadcast' | 'multicast' | 'unicast';

/**
 * Tip smjene za filtriranje
 */
export type ShiftType = 'morning' | 'afternoon';

/**
 * Korisnik u admin notifikaciji (kreator ili primatelj)
 */
export interface AdminNotificationUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: UserRole;
}

/**
 * Izložba u admin notifikaciji
 */
export interface AdminNotificationExhibition {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  open_on: number[];
  status: 'active' | 'upcoming' | 'finished';
  duration_days: number;
  number_of_positions: number;
  is_special_event: boolean;
  event_start_time: string | null;
  event_end_time: string | null;
}

/**
 * Admin notifikacija - potpuni objekt
 */
export interface AdminNotification {
  id: number;
  created_by: AdminNotificationUser | null;
  title: string;
  message: string;
  cast_type: AdminNotificationCastType;
  to_user: AdminNotificationUser | null;
  notification_date: string | null; // YYYY-MM-DD
  shift_type: ShiftType | null;
  exhibition: AdminNotificationExhibition | null;
  expires_at: string; // ISO datetime
  created_at: string;
  updated_at: string;
}

/**
 * Lista admin notifikacija sa paginacijom
 */
export type AdminNotificationListResponse = PaginatedResponse<AdminNotification>;

/**
 * Podaci za kreiranje admin notifikacije
 */
export interface AdminNotificationCreateData {
  title: string;
  message: string;
  cast_type: AdminNotificationCastType;
  to_user_id?: number | null; // Samo za unicast
  notification_date?: string | null; // Samo za multicast - YYYY-MM-DD
  shift_type?: ShiftType | null; // Samo za multicast
  exhibition_id?: number | null; // Samo za multicast
  expires_at: string; // ISO datetime
}

/**
 * Podaci za ažuriranje admin notifikacije
 */
export interface AdminNotificationUpdateData extends Partial<AdminNotificationCreateData> {}

// ========================================
// RECEPTION REPORT TYPES
// ========================================

/**
 * Guard info u reception reportu
 */
export interface ReportGuard {
  id: number;
  username: string;
  full_name: string;
  is_active: boolean;
  priority_number: string;
  availability: number | null;
  availability_updated_at: string | null;
}

/**
 * Position info u reception reportu
 */
export interface ReportPosition {
  id: number;
  exhibition: number;
  exhibition_name: string;
  date: string;
  start_time: string;
  end_time: string;
  is_special_event: boolean;
}

/**
 * Reception Report - prijava recepciji
 */
export interface ReceptionReport {
  id: number;
  guard: ReportGuard;
  position: ReportPosition;
  report_text: string;
  created_at: string;
}

/**
 * Lista reception reporta sa paginacijom
 */
export type ReceptionReportListResponse = PaginatedResponse<ReceptionReport>;

/**
 * Podaci za kreiranje reception reporta
 */
export interface ReceptionReportCreateData {
  position_id: number | string;
  report_text: string;
}

// ========================================
// POINTS TYPES
// ========================================

/**
 * Bod (point) - dodjela bodova čuvaru
 */
export interface Point {
  id: number;
  guard: number;
  guard_name: string;
  points: string; // Decimal kao string
  date_awarded: string; // ISO datetime
  explanation: string;
}

/**
 * Lista bodova sa paginacijom
 */
export type PointListResponse = PaginatedResponse<Point>;

/**
 * Podaci za kreiranje boda
 */
export interface PointCreateData {
  guard: number;
  points: number;
  explanation: string;
}

// ========================================
// AUDIT LOG TYPES
// ========================================

/**
 * Tip akcije za audit log
 */
export type AuditLogAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_UPDATE' | 'BULK_DELETE';

/**
 * Audit log zapis - historizacija svih promjena u sustavu
 */
export interface AuditLog {
  id: number;
  user: number | null;
  user_name: string;
  user_full_name: string;
  action: AuditLogAction;
  action_display: string;
  model_name: string;
  object_id: string;
  object_repr: string;
  changes: Record<string, any>;
  ip_address: string;
  user_agent: string;
  timestamp: string; // ISO datetime
}

/**
 * Lista audit logova sa paginacijom
 */
export type AuditLogListResponse = PaginatedResponse<AuditLog>;

/**
 * Filteri za dohvaćanje audit logova
 */
export interface AuditLogFilters {
  action?: AuditLogAction;
  user_id?: number;
  year?: number;
  month?: number;
  day?: number;
  ordering?: 'timestamp' | '-timestamp';
}
