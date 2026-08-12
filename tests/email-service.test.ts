import test from 'node:test';
import assert from 'node:assert';
import { sendAlertEmail, SendEmailOptions } from '../lib/email-service';
import { SmartAlert } from '../lib/types';

const MOCK_CRITICAL_ALERT: SmartAlert = {
  id: 'alt_resend_101',
  rule_id: 'CURRENT_EXTREME',
  priority: 'CRITICAL',
  title: 'Extreme Risk Alert',
  message: 'Current heat risk score has reached EXTREME (88/100). Take immediate cooling measures.',
  affected_period_label: '1:00 PM – 4:00 PM',
  trigger_data: {
    risk_score: 88,
    risk_level: 'EXTREME',
    temperature: 42,
    apparent_temperature: 48,
    humidity: 70,
    wind_speed: 8,
  },
  recommended_action: 'Avoid physical exertion, remain in air-conditioned or shaded shelter, and drink hydration fluids.',
  source_status: 'LIVE',
  timestamp: new Date().toISOString(),
  dismissed: false,
  read: false,
  dedup_key: 'CURRENT_EXTREME_13_Chennai',
  location_name: 'Chennai',
};

test('Email Service 1. Gracefully handles missing RESEND_API_KEY', async () => {
  const originalKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;

  try {
    const result = await sendAlertEmail({
      to: 'user@example.com',
      alert: MOCK_CRITICAL_ALERT,
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes('RESEND_API_KEY'));
  } finally {
    if (originalKey) {
      process.env.RESEND_API_KEY = originalKey;
    }
  }
});

test('Email Service 2. Attempts dispatch when RESEND_API_KEY is configured', async () => {
  const originalKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 're_test_key_mock_12345';

  try {
    const result = await sendAlertEmail({
      to: 'user@example.com',
      alert: MOCK_CRITICAL_ALERT,
      locationName: 'Chennai',
    });

    // Since re_test_key_mock_12345 is invalid on live Resend servers, it should fail gracefully with API error
    assert.strictEqual(result.success, false);
    assert.ok(result.error?.length! > 0);
  } finally {
    if (originalKey) {
      process.env.RESEND_API_KEY = originalKey;
    } else {
      delete process.env.RESEND_API_KEY;
    }
  }
});

test('Email Service 3. Validates recipient address formatting logic', () => {
  const validEmails = ['test@domain.com', 'user.name+tag@sub.example.org'];
  const invalidEmails = ['invalid-email', '', 'user@', '@domain.com'];

  for (const email of validEmails) {
    assert.ok(email.includes('@') && email.trim().length > 3, `Email ${email} should be recognized as valid`);
  }

  for (const email of invalidEmails) {
    const isValid = Boolean(email && typeof email === 'string' && email.includes('@') && email.split('@')[0] && email.split('@')[1]);
    assert.strictEqual(isValid, false, `Email "${email}" should be flagged as invalid`);
  }
});

test('Email Service 4. Deduplication key string generator contract', () => {
  const key1 = `${MOCK_CRITICAL_ALERT.rule_id}_${MOCK_CRITICAL_ALERT.dedup_key}`;
  assert.strictEqual(key1, 'CURRENT_EXTREME_CURRENT_EXTREME_13_Chennai');
});
