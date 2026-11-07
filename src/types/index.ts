// ── Database row types ────────────────────────────────────────────────────────

export interface User {
  id:            string;
  name:          string;
  email:         string;
  password_hash: string;
  role:          'super_admin' | 'org_admin' | 'guardian' | 'device_user';
  status:        'active' | 'suspended' | 'deleted';
  created_at:    Date;
  updated_at:    Date;
}

export interface Device {
  id:              string;
  user_id:         string;
  name:            string;
  model:           string | null;
  android_version: string | null;
  app_version:     string | null;
  sharing_enabled: boolean;
  battery_level:   number | null;
  network_status:  string | null;
  status:          'active' | 'revoked';
  image_url?:      string | null;
  user_name?:      string | null;
  last_seen_at:    Date | null;
  created_at:      Date;
  updated_at:      Date;
}

export interface DeviceViewer {
  id:             string;
  device_id:      string;
  viewer_user_id: string;
  access_type:    'viewer' | 'admin';
  status:         'active' | 'revoked';
  invited_at:     Date;
  revoked_at:     Date | null;
}

export interface ConsentRecord {
  id:             string;
  device_id:      string;
  user_id:        string;
  purpose:        string;
  status:         'granted' | 'revoked';
  policy_version: string;
  ip_address:     string | null;
  created_at:     Date;
}

export interface SharingSession {
  id:         string;
  device_id:  string;
  started_at: Date;
  stopped_at: Date | null;
  status:     'active' | 'stopped';
}

export interface Location {
  id:          number;
  device_id:   string;
  latitude:    number;
  longitude:   number;
  accuracy:    number | null;
  altitude:    number | null;
  speed:       number | null;
  recorded_at: Date;
  received_at: Date;
}

export interface AuditLog {
  id:               number;
  actor_user_id:    string | null;
  action:           string;
  target_device_id: string | null;
  target_user_id:   string | null;
  metadata:         Record<string, unknown> | null;
  ip_address:       string | null;
  created_at:       Date;
}

export interface RefreshToken {
  id:         string;
  user_id:    string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

// ── API response shapes ───────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface DashboardSummary {
  totalUsers:        number;
  registeredDevices: number;
  sharingEnabled:    number;
  sharingDisabled:   number;
  recentlyUpdated:   number;
  stale:             number;
}
