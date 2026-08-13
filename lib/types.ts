export type AgeGroup = 'child' | 'adult' | 'older_adult' | 'prefer_not_to_say';
export type ExposureType = 'indoors' | 'occasional' | 'work' | 'physical';
export type ActivityLevel = 'low' | 'moderate' | 'high';
export type ExposureDuration = 'short' | 'moderate' | 'long';
export type CoolingAccess = 'good' | 'limited' | 'prefer_not_to_say';
export type Language = 'en' | 'ta' | 'hi';
export type TechMode = 'technical' | 'simple';

export interface UserProfile {
  id: string;
  email?: string;
  name?: string;
  age_group: AgeGroup;
  exposure: ExposureType;
  activity_level: ActivityLevel;
  exposure_duration: ExposureDuration;
  cooling_access: CoolingAccess;
  language: Language;
  location?: LocationData;
  role: 'user' | 'school' | 'worksite' | 'ngo' | 'admin';
  organization_id?: string;
  created_at: string;
  onboarded?: boolean;
  authenticated?: boolean;
  sms_phone?: string;
}

export interface LocationData {
  name: string;
  locality?: string;
  latitude: number;
  longitude: number;
  country?: string;
  /** GPS accuracy in metres from browser Geolocation API (only set when source is GPS) */
  gps_accuracy?: number;
}

export interface WeatherData {
  temperature: number; // Celsius
  relative_humidity: number; // %
  apparent_temperature: number; // Celsius
  wind_speed: number; // km/h
  pressure: number; // hPa
  weather_code: number; // WMO code
  timestamp: string;
  is_cached?: boolean;
  cache_timestamp?: string;
  /** True when data is the hardcoded emergency fallback (no real API or cache available) */
  is_fallback?: boolean;
  location: LocationData;
  hourly_forecast?: HourlyForecast[];
}

export interface HourlyForecast {
  time: string; // ISO string
  temperature: number;
  relative_humidity: number;
  apparent_temperature: number;
  wind_speed: number;
  weather_code: number;
  risk_score?: number;
  risk_level?: RiskLevel;
}

/** Enriched hourly forecast with computed risk score and UI display metadata. */
export interface HourlyForecastRisk {
  forecast: HourlyForecast;
  risk_score: number;
  risk_level: RiskLevel;
  data_label: 'CURRENT OBSERVATION' | 'FORECAST' | 'CACHED FORECAST';
  is_peak: boolean;
  is_trough: boolean;
  trend_direction: 'RISING' | 'FALLING' | 'STABLE';
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';


export interface RiskFactor {
  name: string;
  category: 'temperature' | 'humidity' | 'exposure' | 'activity' | 'forecast';
  impact: 'low' | 'moderate' | 'high' | 'critical';
  weight_percent: number; // e.g. 35%
  description_technical: string;
  description_simple: string;
}

export interface RiskAssessment {
  id: string;
  timestamp: string;
  risk_score: number; // 0 - 100
  risk_level: RiskLevel;
  factors: RiskFactor[];
  weather_snapshot: {
    temp: number;
    humidity: number;
    apparent_temp: number;
    wind: number;
  };
  context_snapshot: {
    activity: ActivityLevel;
    duration: ExposureDuration;
    cooling: CoolingAccess;
    age_group: AgeGroup;
  };
  recommendations: SafetyGuidance[];
  model_version: string;
  data_source: string;
  data_quality: 'Good' | 'Stale' | 'Estimated';
  limitations: string;
}

export interface SafetyGuidance {
  id: string;
  category: 'hydration' | 'cooling' | 'exposure' | 'rest' | 'community';
  title: string;
  technical_text: string;
  simple_text: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export type CommunityCategory =
  | 'water_access'
  | 'shade_cooling'
  | 'outdoor_heat'
  | 'cooling_facility'
  | 'unsafe_condition'
  | 'infrastructure'
  | 'public_space'
  | 'other';

export type ReportStatus = 'NEW' | 'SUBMITTED' | 'UNDER_REVIEW' | 'REVIEWED' | 'VERIFIED' | 'RESOLVED' | 'REJECTED';

export type ReportSeverity = 'info' | 'warning' | 'critical';

export interface CommunityReport {
  id: string;
  user_id: string;
  category: CommunityCategory;
  description: string;
  location: LocationData;
  timestamp: string;
  status: ReportStatus;
  severity?: ReportSeverity;
  image_url?: string;
  votes_count: number;
  data_type?: 'COMMUNITY_REPORT';
}

export interface VerifiedCoolingLocation {
  id: string;
  name: string;
  category: 'cooling_center' | 'water_refill' | 'shaded_park' | 'air_conditioned_facility';
  address: string;
  location: LocationData;
  is_verified: boolean;
  operating_hours?: string;
  contact_phone?: string;
  data_type: 'VERIFIED_LOCATION';
}

export interface CommunityCluster {
  id: string;
  category: string;
  report_ids: string[];
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
  report_count: number;
  status_label: string;
  detected_at: string;
}

/** Legacy alert type — retained for backward compat with existing store functions. */
export interface AlertItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  read: boolean;
  category: 'risk_change' | 'forecast_warning' | 'community_alert' | 'system';
}

// ─── Phase 5: Smart Alert Engine Types ───────────────────────────────────────

export type AlertPriority = 'INFO' | 'CAUTION' | 'HIGH PRIORITY' | 'CRITICAL';

export type AlertRuleId =
  | 'TIER_ESCALATION'
  | 'FORECAST_HIGH'
  | 'FORECAST_EXTREME'
  | 'RAPID_RISE'
  | 'SUSTAINED_HIGH'
  | 'SUSTAINED_EXTREME'
  | 'CURRENT_EXTREME'
  | 'TRANSITION_MODERATE_TO_HIGH'
  | 'TRANSITION_HIGH_TO_EXTREME'
  | 'LOCATION_RISK_INCREASE'
  | 'RISK_RECOVERY';

/** A structured, rule-based alert generated by the Smart Alert Engine. */
export interface SmartAlert {
  id: string;
  rule_id: AlertRuleId;
  priority: AlertPriority;
  title: string;
  message: string;
  /** ISO time string of the forecast hour this alert pertains to, if applicable. */
  affected_period?: string;
  /** Human-readable affected window, e.g. "12:00 PM – 3:00 PM" */
  affected_period_label?: string;
  /** Environmental snapshot that triggered the alert. */
  trigger_data: {
    temperature?: number;
    apparent_temperature?: number;
    humidity?: number;
    wind_speed?: number;
    pressure?: number;
    risk_score: number;
    risk_level: RiskLevel;
  };
  /** Recommended preventive action. */
  recommended_action: string;
  /** Data source status at time of alert generation. */
  source_status: 'LIVE' | 'CACHED' | 'FORECAST' | 'UNAVAILABLE';
  timestamp: string;
  dismissed: boolean;
  read: boolean;
  /** Deduplication key: rule_id + affected_period_hour. */
  dedup_key: string;
  /** Location context when the notification was generated. */
  location_name?: string;
  /** Technical reason why this alert was generated. */
  why_generated?: string;
  /** Primary XAI risk drivers. */
  drivers?: Array<{ name: string; impact_percent: number }>;
  /** Email delivery status */
  email_status?: 'SENT' | 'FAILED' | 'PENDING' | 'SKIPPED';
  /** SMS delivery status */
  sms_status?: 'SENT' | 'FAILED' | 'NOT_CONFIGURED' | 'PENDING' | 'SKIPPED';
  /** 5-7 actionable precautions */
  precautions?: string[];
  /** Medical safety notice */
  medical_disclaimer?: string;
  /** Weather snapshot */
  weather_snapshot?: {
    temperature?: number;
    apparent_temperature?: number;
    humidity?: number;
    weather_code?: number;
  };
}

/** User-configurable alert settings. */
export interface AlertSettings {
  alerts_enabled: boolean;
  min_severity: AlertPriority;
  forecast_alerts_enabled: boolean;
  browser_notifications_enabled: boolean;
  location_alerts_enabled?: boolean;
  recovery_alerts_enabled?: boolean;
  email_notifications_enabled?: boolean;
  sms_notifications_enabled?: boolean;
}


/** Time range annotation for rising/falling risk periods. */
export interface RangeAnnotation {
  start_index: number;
  end_index: number;
  start_time: string;
  end_time: string;
  start_score: number;
  end_score: number;
  delta: number;
}

/** Summary of forecast trend analysis. */
export interface ForecastTrend {
  peak: { index: number; time: string; score: number; level: RiskLevel } | null;
  trough: { index: number; time: string; score: number; level: RiskLevel } | null;
  rising_periods: RangeAnnotation[];
  falling_periods: RangeAnnotation[];
  /** Whether forecast data was available for trend analysis. */
  data_available: boolean;
}

export type OrganizationType = 'school' | 'worksite' | 'ngo';

export type OrganizationRole =
  | 'admin'
  | 'organization_admin'
  | 'manager'
  | 'staff'
  | 'member'
  | 'school'
  | 'worksite'
  | 'ngo'
  | 'user';

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  locality?: string;
  latitude: number;
  longitude: number;
  member_count: number;
  primary_location: LocationData;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  email?: string;
  role: OrganizationRole;
  joined_at: string;
}

export interface AuditLogItem {
  id: string;
  organization_id?: string;
  user_id?: string;
  action: string;
  details?: string | Record<string, any>;
  created_at: string;
}

export interface OrganizationData {
  id: string;
  name: string;
  type: OrganizationType;
  member_count: number;
  primary_location: LocationData;
  active_alerts_count: number;
  action_plan_completed_steps: string[];
}

export interface MLMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  macro_f1: number;
  confusion_matrix: number[][];
  model_name: string;
  version: string;
  training_samples: number;
  trained_at: string;
}

export type LocationSourceStatus = 'LIVE_GPS' | 'SAVED_LOCATION' | 'MANUAL_LOCATION' | 'UNAVAILABLE';
export type WeatherSourceStatus = 'LIVE' | 'CACHED' | 'STALE' | 'UNAVAILABLE';

/** Registered Recipient Profile for Automated Notifications */
export interface RecipientNotificationProfile {
  id: string;
  user_id?: string;
  email: string;
  display_name?: string;
  /** Age is ONLY included if voluntarily provided by the user. Never guessed. */
  age?: number;
  location_name: string;
  latitude: number;
  longitude: number;
  location_source: LocationSourceStatus;
  email_alerts_enabled: boolean;
  hourly_summary_enabled: boolean;
  critical_alerts_enabled: boolean;
  forecast_alerts_enabled?: boolean;
  last_notification_at?: string;
  sms_phone?: string;
  created_at: string;
  updated_at?: string;
}

/** Persistent Log Record of Scheduled or Triggered Notification Dispatch */
export interface NotificationLog {
  id: string;
  recipient_id: string;
  recipient_email: string;
  alert_type: string;
  risk_level: RiskLevel;
  location_name: string;
  latitude?: number;
  longitude?: number;
  location_status: LocationSourceStatus;
  temperature?: number;
  feels_like_temperature?: number;
  humidity?: number;
  weather_condition?: string;
  weather_status: WeatherSourceStatus;
  risk_score?: number;
  precautions?: string[];
  provider: 'Resend' | 'Twilio';
  provider_message_id?: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  failure_reason?: string;
  /** Unique idempotency key: recipient_email + scheduled_hour + alert_type */
  idempotency_key: string;
  scheduled_for?: string;
  sent_at: string;
  created_at: string;
}

