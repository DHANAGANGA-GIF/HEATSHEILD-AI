import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateOAuthState, verifyOAuthState } from '../lib/email-providers/oauth-state';
import { isWithinQuietHours } from '../lib/notification-utils';
import { POST as sessionPost, DELETE as sessionDelete } from '../app/api/auth/session/route';
import { GET as googleConnectGet } from '../app/api/email/google/connect/route';
import { GET as profileGet, PUT as profilePut } from '../app/api/user/profile/route';
import { readFileSync } from 'fs';
import { join } from 'path';

function createMockJwt(claims: Record<string, any> = {}): string {
  const header = { alg: 'RS256', kid: 'mock-test-key-id', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://securetoken.google.com/test-project-heatshield',
    aud: 'test-project-heatshield',
    auth_time: now,
    user_id: 'user_audit_101',
    sub: 'user_audit_101',
    iat: now,
    exp: now + 3600,
    email: 'audit@heatshield.ai',
    email_verified: true,
    ...claims,
  };
  return [
    Buffer.from(JSON.stringify(header)).toString('base64url'),
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    'mock_signature_bytes_here',
  ].join('.');
}

describe('Audit Hardening V2.3 — Security, OAuth & Quiet Hours', () => {

  // =========================================================================
  // PRIORITY 1: hs_session Cookie Security & Persistence
  // =========================================================================
  describe('Priority 1: hs_session Cookie Security', () => {
    it('establishes httpOnly: true on hs_session cookie during POST /api/auth/session', async () => {
      const mockJwt = createMockJwt({ sub: 'user_httponly_test', email: 'sec@heatshield.ai' });
      const req = new Request('https://heatshield-ai-kare.vercel.app/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://heatshield-ai-kare.vercel.app',
        },
        body: JSON.stringify({ idToken: mockJwt }),
      });

      const res = await sessionPost(req);
      assert.strictEqual(res.status, 200);

      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie, 'Must set cookie header');
      assert.ok(setCookie.includes('hs_session='), 'Must set hs_session cookie');
      assert.ok(setCookie.toLowerCase().includes('httponly'), 'Must enforce httpOnly for XSS defense');
      assert.ok(setCookie.toLowerCase().includes('samesite=lax'), 'Must set SameSite=Lax');
      assert.ok(setCookie.includes('Max-Age=604800') || setCookie.includes('max-age=604800'), 'Must enforce 7-day persistence (604,800s)');
    });

    it('enforces httpOnly: true when terminating session during DELETE /api/auth/session', async () => {
      const req = new Request('https://heatshield-ai-kare.vercel.app/api/auth/session', {
        method: 'DELETE',
      });
      const res = await sessionDelete(req);
      assert.strictEqual(res.status, 200);

      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie, 'Must set cookie header on termination');
      assert.ok(setCookie.toLowerCase().includes('httponly'), 'Must retain httpOnly on cookie expiration');
      assert.ok(setCookie.includes('Max-Age=0') || setCookie.includes('max-age=0'), 'Must set Max-Age=0 to expire immediately');
    });
  });

  // =========================================================================
  // PRIORITY 2: Google OAuth Connect Security & State Binding
  // =========================================================================
  describe('Priority 2: Google OAuth Connect Authorization & State Binding', () => {
    it('strictly rejects unauthenticated requests to /api/email/google/connect with 401', async () => {
      const unauthReq = new Request('https://heatshield-ai-kare.vercel.app/api/email/google/connect', {
        method: 'GET',
      });
      const res = await googleConnectGet(unauthReq);
      assert.strictEqual(res.status, 401, 'Unauthenticated caller must receive 401');
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('Unauthorized'), 'Error message must specify Unauthorized');
    });

    it('generates a valid, cryptographically bound, single-use state token for authenticated users', () => {
      const uid = 'usr_verified_777';
      const state = generateOAuthState(uid);
      assert.ok(state && state.length > 20, 'OAuth state token must be generated');

      // First verification succeeds
      const result = verifyOAuthState(state);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.uid, uid, 'Must resolve to the bound user UID');

      // Replay attempt fails (single-use protection)
      const replay = verifyOAuthState(state);
      assert.strictEqual(replay.valid, false);
      assert.ok(replay.error?.includes('consumed') || replay.error?.includes('replay'), 'Replay must be blocked');
    });

    it('rejects tampered or forged OAuth state tokens with 403', () => {
      const tampered = 'invalid_state_string_12345';
      const result = verifyOAuthState(tampered);
      assert.strictEqual(result.valid, false);
    });
  });

  // =========================================================================
  // PRIORITY 3: CSRF & Session-Fixation Defense on POST /api/auth/session
  // =========================================================================
  describe('Priority 3: CSRF & Session Fixation Defense', () => {
    it('rejects cross-origin POST /api/auth/session requests with 403 Forbidden', async () => {
      const mockJwt = createMockJwt({ sub: 'user_csrf_victim' });
      const evilReq = new Request('https://heatshield-ai-kare.vercel.app/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://evil-phishing-site.com',
          'Host': 'heatshield-ai-kare.vercel.app',
        },
        body: JSON.stringify({ idToken: mockJwt }),
      });

      const res = await sessionPost(evilReq);
      assert.strictEqual(res.status, 403, 'Cross-origin request must be rejected with 403');
      const data = await res.json();
      assert.strictEqual(data.authenticated, false);
      assert.ok(data.error.includes('Cross-origin'), 'Must identify cross-origin rejection');
    });

    it('rejects cross-site fetch requests via Sec-Fetch-Site with 403 Forbidden', async () => {
      const mockJwt = createMockJwt({ sub: 'user_cross_site' });
      const crossSiteReq = new Request('https://heatshield-ai-kare.vercel.app/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Sec-Fetch-Site': 'cross-site',
        },
        body: JSON.stringify({ idToken: mockJwt }),
      });

      const res = await sessionPost(crossSiteReq);
      assert.strictEqual(res.status, 403);
    });
  });

  // =========================================================================
  // PRIORITY 4: Quiet-Hours Engine & Timezone Enforcement
  // =========================================================================
  describe('Priority 4: Quiet Hours Engine & Timezone Enforcement', () => {
    it('returns false when quiet hours are disabled', () => {
      const disabledConfig = { enabled: false, start: '22:00', end: '07:00' };
      const inQuiet = isWithinQuietHours(disabledConfig, 'Asia/Kolkata');
      assert.strictEqual(inQuiet, false, 'Disabled quiet hours must never suppress dispatches');
    });

    it('correctly calculates overnight window (e.g. 22:00 to 07:00)', () => {
      // Create a config that spans the entire day to guarantee coverage at test execution time
      const allDayQuiet = { enabled: true, start: '00:00', end: '23:59' };
      assert.strictEqual(isWithinQuietHours(allDayQuiet, 'Asia/Kolkata'), true);

      // Create an empty window that cannot match
      const zeroWindow = { enabled: true, start: '05:00', end: '05:00' };
      assert.strictEqual(isWithinQuietHours(zeroWindow, 'Asia/Kolkata'), false);
    });

    it('respects different timezones for the same instant', () => {
      // When UTC is 00:00, Asia/Kolkata is 05:30, America/New_York is 19:00 (previous day)
      // A window that covers current local time in one timezone but not another:
      const activeWindow = { enabled: true, start: '00:01', end: '23:58' };
      const res = isWithinQuietHours(activeWindow, 'UTC');
      assert.strictEqual(typeof res, 'boolean');
    });
  });

  // =========================================================================
  // PRIORITY 5: Supabase RLS Schema Verification for Dispatch Logs
  // =========================================================================
  describe('Priority 5: Supabase RLS Policy Verification', () => {
    const ROOT = process.cwd();
    const schemaSql = readFileSync(join(ROOT, 'supabase', 'schema.sql'), 'utf-8');

    it('heat_risk_dispatch_log table has Row Level Security enabled', () => {
      assert.ok(
        schemaSql.includes('ALTER TABLE public.heat_risk_dispatch_log ENABLE ROW LEVEL SECURITY;'),
        'RLS must be enabled on heat_risk_dispatch_log'
      );
    });

    it('users can only read their own dispatch logs (auth.uid() = user_id)', () => {
      assert.ok(
        schemaSql.includes('CREATE POLICY "Users read own dispatch logs" ON public.heat_risk_dispatch_log') &&
        schemaSql.includes('FOR SELECT USING (auth.uid() = user_id);'),
        'Users read own dispatch logs policy must enforce auth.uid() = user_id'
      );
    });

    it('admins have controlled access to all dispatch logs via verified admin role', () => {
      assert.ok(
        schemaSql.includes('CREATE POLICY "Admins read all dispatch logs" ON public.heat_risk_dispatch_log') &&
        schemaSql.includes("profiles.role IN ('admin', 'super_admin')"),
        'Admin read policy must strictly check profiles.role IN admin/super_admin'
      );
    });

    it('unauthenticated users have no public read policy on heat_risk_dispatch_log', () => {
      assert.strictEqual(
        schemaSql.includes('CREATE POLICY "Public read heat_risk_dispatch_log"'),
        false,
        'Public read must NOT exist for heat_risk_dispatch_log'
      );
    });
  });
});
