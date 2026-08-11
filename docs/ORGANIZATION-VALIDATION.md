# HEATSHIELD AI — PHASE 7: ORGANIZATION INTELLIGENCE VALIDATION DOCUMENTATION

## 1. Executive Summary

HeatShield AI Phase 7 implements enterprise organization decision-support dashboards for **Schools**, **Worksites**, **NGOs**, and **Platform Administrators**. The architecture establishes organization-level data isolation, role-based access control (RBAC), database Row Level Security (RLS) policies, structured audit logging, and specialized decision-support workflows.

---

## 2. Organization & Membership Model

### Entities & Data Structure

```ts
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
```

---

## 3. Database Schema & RLS Policies (`public.organization_members`)

### PostgreSQL Table Definition

```sql
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('admin', 'organization_admin', 'manager', 'staff', 'member', 'school', 'worksite', 'ngo', 'user')) DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members (user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members (organization_id);
```

### Row Level Security (RLS) Isolation Policies

```sql
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 1. Read Isolation: Users can view only organizations where they hold active membership
CREATE POLICY "Members read own organization" ON public.organizations FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = public.organizations.id AND user_id = auth.uid()));

-- 2. Management Policy: Only Organization Admins can manage organization settings
CREATE POLICY "Org Admins manage own organization" ON public.organizations FOR ALL
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = public.organizations.id AND user_id = auth.uid() AND role IN ('admin', 'organization_admin')));

-- 3. Member List Isolation: Members can view fellow members within their organization only
CREATE POLICY "Members read organization members" ON public.organization_members FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
```

---

## 4. Role-Based Access Control (RBAC) Matrix

| Role | View Dashboards | Execute Moderation | Edit Org Settings | Manage Users & Roles | Access Admin Console |
|---|---|---|---|---|---|
| **ADMIN** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **ORGANIZATION_ADMIN** | ✓ | ✓ | ✓ | ✓ | ✓ (Org Level) |
| **MANAGER / OFFICER** | ✓ | ✓ | ✗ | ✗ | ✗ |
| **STAFF / MEMBER** | ✓ | ✗ | ✗ | ✗ | ✗ |
| **UNAUTHENTICATED** | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## 5. Domain Workflows

### A. School Portal (`app/school/page.tsx`)
- **Use Case**: Recess and physical education activity safety for children.
- **Decision Engine**: Evaluates apparent heat load under high physical activity for children.
- **Rules**: Recommends moving sports indoors if heat risk level exceeds HIGH/EXTREME thresholds.
- **Privacy Disclosure**: Individual student health records or medical information are strictly prohibited and never collected.

### B. Worksite Portal (`app/worksite/page.tsx`)
- **Use Case**: Heavy outdoor manual labor safety for construction/infrastructure projects.
- **Decision Engine**: Calculates NIOSH/OSHA-aligned work-rest cycle ratios (e.g. 30m work / 30m rest under high heat).
- **Protocols**: Enforces 1 L/hr worker hydration target and shaded rest shelter deployment.
- **Disclaimer**: Operates as environmental heat-risk decision support; does not constitute legal certification or regulatory medical guarantee.

### C. NGO Portal (`app/ngo/page.tsx`)
- **Use Case**: Community vulnerability hotspot identification & emergency water relief dispatch.
- **Data Legend**: Distinguishes `LIVE ENVIRONMENTAL DATA`, `ML RISK ESTIMATE`, `COMMUNITY REPORT`, and `VERIFIED LOCATION`.
- **Workflow**: Review, verify, and resolve crowdsourced community water access reports.
- **Disclosure**: Population metrics reflect crowdsourced observations; no synthetic statistics are fabricated.

### D. Admin Console (`app/admin/page.tsx`)
- **Use Case**: Platform management, organization provisioning, community moderation, audit logging, and ML evaluation.
- **Security Safeguards**: Access restricted to authorized admins. Secret credentials (passwords, tokens, API keys) are never exposed.

---

## 6. Audit Logging System

Important organization actions are logged to `public.audit_logs` without exposing credentials or PII:

```ts
logAuditEvent(action: string, details?: any, userId?: string, orgId?: string)
```

Logged Actions Include:
- `ADMIN_CREATE_ORGANIZATION`
- `ADMIN_DELETE_REPORT`
- `SCHOOL_CHECKLIST_UPDATE`
- `WORKSITE_CHECKLIST_UPDATE`
- `NGO_MODERATE_REPORT`

---

## 7. Failure Handling & Degradation Matrix

| Failure Mode | System Response | Fallback Behavior |
|---|---|---|
| **Supabase Client Offline** | Catches connection error gracefully | LocalStorage / memory store serves organization data |
| **Weather API Unreachable** | Logs API error | Serves cached WMO weather payload with indicator banner |
| **Unauthorized Role Access** | Blocks restricted administrative routes | Displays "ACCESS RESTRICTED" warning banner |
| **Empty Organization** | Detects zero incidents or reports | Displays clean empty state without synthetic numbers |

---

## 8. Test Execution Summary

### Summary: 66 / 66 PASSING (100% Success)

```
✔ AI Assistant: Emergency Safety Trigger
✔ AI Assistant: Risk Driver Question
✔ AI Assistant: Guidance & Precautions Question
✔ AI Assistant: Forecast & Peak Hours Question
✔ AI Assistant: Simple Mode Response
✔ AI Assistant: Technical Mode Response
✔ AI Assistant: Missing Environmental Data Handling
✔ AI Assistant: Empty Input Handling
✔ AI Assistant: Cached Data Status Preservation
✔ AI Assistant: General Fallback Question
✔ Haversine Distance Calculation
✔ Spatial Community Cluster Detection
✔ 1. Report Validation: Description length & HTML script stripping
✔ 2. Coordinate Validation: Latitude/Longitude boundary checks
✔ 3. Report Creation: Object instantiation & timestamping
✔ 4. Report Retrieval: Fetching list with correct format
✔ 5. Category Filtering: Subsetting reports by category
✔ 6. Nearby Filtering: Haversine distance threshold filtering
✔ 7. Status Lifecycle Handling: SUBMITTED -> UNDER_REVIEW -> RESOLVED
✔ 8. Duplicate Submission Protection: Cooldown rate limiting
✔ 9. Unauthorized Access Protection: Missing user context safeguards
✔ 10. RLS / User Isolation: User can modify/delete only own report
✔ 11. Map Failure & Fallback: Graceful degradation for invalid locations
✔ 12. Supabase Failure & Local Store Fallback: Seamless offline operation
✔ 13. Invalid Input Parameter Handling: Unsupported categories & invalid inputs
✔ Forecast Engine: Valid forecast array parsed correctly
✔ Forecast Engine: Risk scores calculated via risk engine
✔ Forecast Engine: Increasing risk periods detected
✔ Forecast Engine: Decreasing risk periods detected
✔ Forecast Engine: Peak risk period correctly identified
✔ Alert Engine: HIGH tier alert generated when forecast reaches HIGH
✔ Alert Engine: EXTREME alert generated when forecast score >= 81
✔ Alert Engine: Alert deduplication prevents repeat within cooldown
✔ Alert Engine: Dismissed alerts are marked dismissed, not deleted
✔ Alert Engine: Min severity filter respected
✔ Forecast Engine: Empty forecast array returns empty scored array
✔ Alert Engine: No alerts generated when source is UNAVAILABLE
✔ Forecast Engine: Cached data marked as CACHED FORECAST in data_label
✔ Alert Engine: Alerts generated without requesting browser notification permission
✔ Forecast Engine: Invalid forecast entries handled gracefully
✔ 1. Organization Creation: Instantiation with location & type
✔ 2. Membership Management: Adding users with assigned roles
✔ 3. Role Permissions (RBAC): Checking admin vs manager vs member actions
✔ 4. Organization Isolation: Preventing cross-organization access
✔ 5. School Dashboard Logic: PE recess decision rules under thermal load
✔ 6. Worksite Dashboard Logic: NIOSH work-rest cycle ratio for manual labor
✔ 7. NGO Dashboard Logic: Incident moderation state updates
✔ 8. Admin Authorization: Verifying admin role access safeguards
✔ 9. Audit Logging Engine: Action logging without sensitive credential leaks
✔ 10. Unauthorized Access Protection: Rejecting invalid role access
✔ 11. Empty Organization Handling: Zero incidents & empty state resolution
✔ 12. Supabase Failure Fallback: Seamless offline storage operation
✔ 13. API Failure Fallback: Graceful weather & heat risk fallback
✔ Steadman Heat Index Calculation
✔ Heat Risk Engine Evaluation
✔ Risk Simulator: Baseline Scenario Initialization
✔ Risk Simulator: Activity Level Change Scenario
✔ Risk Simulator: Exposure Duration Change Scenario
✔ Risk Simulator: Location Change Scenario
✔ Risk Simulator: Score Diff Calculation
✔ Risk Simulator: Risk Tier Transition
✔ Risk Simulator: Extreme Input Values
✔ Risk Simulator: Reset Scenario
✔ Risk Simulator: Missing Weather Data Handling
✔ Risk Simulator: ML & Contextual Notice Inclusion
✔ Risk Simulator: Mandatory Labeling Assertion

ℹ tests 66
ℹ suites 0
ℹ pass 66
ℹ fail 0
ℹ duration_ms 545.19ms
```
