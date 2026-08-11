import { AuditLogItem, LocationData, Organization, OrganizationMember, OrganizationRole, OrganizationType } from './types';
import { isSupabaseConfigured, supabase } from './supabase';

const ORGANIZATIONS_KEY = 'heatshield_organizations';
const ORG_MEMBERS_KEY = 'heatshield_org_members';
const AUDIT_LOGS_KEY = 'heatshield_audit_logs';

export const DEFAULT_ORGANIZATIONS: Organization[] = [
  {
    id: 'org_school_01',
    name: 'Chennai Model Public School',
    type: 'school',
    locality: 'Egmore, Chennai',
    latitude: 13.0732,
    longitude: 80.2610,
    member_count: 450,
    primary_location: { name: 'Egmore Campus', locality: 'Chennai', latitude: 13.0732, longitude: 80.2610 },
    created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  {
    id: 'org_worksite_01',
    name: 'Metro Line Infra Site Alpha',
    type: 'worksite',
    locality: 'Central Metro Plaza, Chennai',
    latitude: 13.0815,
    longitude: 80.2725,
    member_count: 85,
    primary_location: { name: 'Central Metro Site', locality: 'Chennai', latitude: 13.0815, longitude: 80.2725 },
    created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
  },
  {
    id: 'org_ngo_01',
    name: 'Tamil Nadu Heat-Relief Alliance',
    type: 'ngo',
    locality: 'Anna Salai, Chennai',
    latitude: 13.0830,
    longitude: 80.2710,
    member_count: 120,
    primary_location: { name: 'Anna Salai HQ', locality: 'Chennai', latitude: 13.0830, longitude: 80.2710 },
    created_at: new Date(Date.now() - 86400000 * 90).toISOString(),
  },
];

export const DEFAULT_MEMBERS: OrganizationMember[] = [
  {
    id: 'mem_1',
    organization_id: 'org_school_01',
    user_id: 'usr_demo_101',
    name: 'Demo User',
    email: 'demo.user@heatshield.org',
    role: 'school',
    joined_at: new Date().toISOString(),
  },
  {
    id: 'mem_2',
    organization_id: 'org_worksite_01',
    user_id: 'usr_demo_102',
    name: 'Worksite Manager',
    email: 'safety@worksite.org',
    role: 'worksite',
    joined_at: new Date().toISOString(),
  },
  {
    id: 'mem_3',
    organization_id: 'org_ngo_01',
    user_id: 'usr_demo_103',
    name: 'NGO Field Coordinator',
    email: 'contact@reliefngo.org',
    role: 'ngo',
    joined_at: new Date().toISOString(),
  },
  {
    id: 'mem_4',
    organization_id: 'org_school_01',
    user_id: 'usr_admin_99',
    name: 'System Admin',
    email: 'admin@heatshield.org',
    role: 'admin',
    joined_at: new Date().toISOString(),
  },
];

// In-memory fallback stores for non-browser Node test execution
let memoryOrgs: Organization[] = [...DEFAULT_ORGANIZATIONS];
let memoryMembers: OrganizationMember[] = [...DEFAULT_MEMBERS];
let memoryLogs: AuditLogItem[] = [
  {
    id: 'log_seed_1',
    action: 'SYSTEM_INITIALIZATION',
    details: 'Organization Security & Isolation Engine Active',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

export function getOrganizations(): Organization[] {
  if (typeof window === 'undefined') return memoryOrgs;
  const stored = localStorage.getItem(ORGANIZATIONS_KEY);
  if (!stored) {
    localStorage.setItem(ORGANIZATIONS_KEY, JSON.stringify(DEFAULT_ORGANIZATIONS));
    return DEFAULT_ORGANIZATIONS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_ORGANIZATIONS;
  }
}

export function getOrganizationById(id: string): Organization | undefined {
  const orgs = getOrganizations();
  return orgs.find((o) => o.id === id);
}

export function createOrganization(
  name: string,
  type: OrganizationType,
  location: LocationData
): Organization {
  const orgs = getOrganizations();
  const newOrg: Organization = {
    id: `org_${type}_${Date.now()}`,
    name,
    type,
    locality: location.locality || location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    member_count: 1,
    primary_location: location,
    created_at: new Date().toISOString(),
  };

  const updated = [newOrg, ...orgs];
  memoryOrgs = updated;
  if (typeof window !== 'undefined') {
    localStorage.setItem(ORGANIZATIONS_KEY, JSON.stringify(updated));
  }
  return newOrg;
}

export function getOrganizationMembers(orgId?: string): OrganizationMember[] {
  let list: OrganizationMember[] = memoryMembers;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(ORG_MEMBERS_KEY);
    if (stored) {
      try {
        list = JSON.parse(stored);
      } catch {
        list = memoryMembers;
      }
    }
  }

  if (orgId) {
    return list.filter((m) => m.organization_id === orgId);
  }
  return list;
}

export function addOrganizationMember(
  orgId: string,
  userId: string,
  name: string,
  role: OrganizationRole,
  email?: string
): OrganizationMember {
  const members = getOrganizationMembers();
  const newMember: OrganizationMember = {
    id: `mem_${Date.now()}`,
    organization_id: orgId,
    user_id: userId,
    name,
    email,
    role,
    joined_at: new Date().toISOString(),
  };

  const updated = [newMember, ...members];
  memoryMembers = updated;
  if (typeof window !== 'undefined') {
    localStorage.setItem(ORG_MEMBERS_KEY, JSON.stringify(updated));
  }
  return newMember;
}

export function isUserInOrganization(userId: string, orgId: string): boolean {
  if (!userId || !orgId) return false;
  const members = getOrganizationMembers(orgId);
  return members.some((m) => m.user_id === userId);
}

export function getUserRoleInOrganization(userId: string, orgId: string): OrganizationRole | null {
  const members = getOrganizationMembers(orgId);
  const m = members.find((mem) => mem.user_id === userId);
  return m ? m.role : null;
}

export function isAdminAuthorized(role?: string): boolean {
  if (!role) return false;
  const adminRoles = ['admin', 'organization_admin', 'admin_role'];
  return adminRoles.includes(role.toLowerCase());
}

export function hasPermission(
  role: OrganizationRole | string,
  action: 'manage_users' | 'edit_org' | 'moderate_reports' | 'view_dashboard'
): boolean {
  if (!role) return false;
  const r = role.toLowerCase();

  if (r === 'admin' || r === 'organization_admin') return true;

  if (action === 'view_dashboard') return true;

  if (action === 'moderate_reports') {
    return r === 'manager' || r === 'school' || r === 'worksite' || r === 'ngo';
  }

  if (action === 'manage_users' || action === 'edit_org') {
    return r === 'admin' || r === 'organization_admin';
  }

  return false;
}

// ─── Audit Logging Engine ───────────────────────────────────────────────────

export function logAuditEvent(
  action: string,
  details?: any,
  userId?: string,
  orgId?: string
): AuditLogItem {
  const storedLogs = getAuditLogs();
  const newLog: AuditLogItem = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    organization_id: orgId,
    user_id: userId || 'usr_system',
    action,
    details: details ? (typeof details === 'string' ? details : JSON.stringify(details)) : undefined,
    created_at: new Date().toISOString(),
  };

  const updated = [newLog, ...storedLogs].slice(0, 100);
  memoryLogs = updated;
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(updated));
  }

  if (isSupabaseConfigured && supabase) {
    try {
      supabase.from('audit_logs').insert([
        {
          user_id: userId && !userId.startsWith('usr_demo') ? userId : null,
          action,
          details: details || {},
        },
      ]);
    } catch (e) {
      // Graceful fallback
    }
  }

  return newLog;
}

export function getAuditLogs(orgId?: string): AuditLogItem[] {
  let logs: AuditLogItem[] = memoryLogs;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(AUDIT_LOGS_KEY);
    if (stored) {
      try {
        logs = JSON.parse(stored);
      } catch {
        logs = memoryLogs;
      }
    }
  }

  if (orgId) {
    return logs.filter((l) => !l.organization_id || l.organization_id === orgId);
  }
  return logs;
}
