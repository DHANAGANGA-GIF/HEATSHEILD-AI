import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getLocalizedAlertEmail, generateEmailContent } from '../lib/email-providers/template';
import { getPrecautions } from '../lib/precaution-engine';
import { getEmailServiceStatus } from '../lib/email-service';
import { SmartAlert, Language } from '../lib/types';

describe('HEATSHIELD AI — FINAL PRODUCTION QA & EMAIL/LANGUAGE POLISH', () => {

  // =========================================================================
  // 1. MULTILINGUAL EMAIL VERIFICATION (EN, TE, TA, HI)
  // =========================================================================
  describe('1. Multilingual Email End-to-End Rendering', () => {
    const testCases: Array<{
      lang: Language;
      expectedLangCode: string;
      expectedSubHeader: string;
      expectedGreetingPrefix: string;
      expectedRiskLabel: string;
      expectedTempLabel: string;
      expectedWhyTitle: string;
      expectedActNowTitle: string;
      expectedReassessTitle: string;
      expectedEmergencyTitle: string;
      expectedFooterDisclaimer: string;
    }> = [
      {
        lang: 'en',
        expectedLangCode: 'en',
        expectedSubHeader: 'CURRENT HEAT RISK ADVISORY',
        expectedGreetingPrefix: 'Hello Priya,',
        expectedRiskLabel: 'EXTREME',
        expectedTempLabel: 'Air Temperature',
        expectedWhyTitle: 'WHY THIS ALERT WAS TRIGGERED',
        expectedActNowTitle: 'PERSONALIZED PREVENTIVE PRECAUTIONS',
        expectedReassessTitle: 'WHEN TO REASSESS',
        expectedEmergencyTitle: 'EMERGENCY MEDICAL GUIDANCE',
        expectedFooterDisclaimer: 'HeatShield AI is an environmental safety decision-support platform.',
      },
      {
        lang: 'te',
        expectedLangCode: 'te',
        expectedSubHeader: 'ప్రస్తుత వేడి ప్రమాద హెచ్చరిక',
        expectedGreetingPrefix: 'నమస్కారం Priya,',
        expectedRiskLabel: 'తీవ్రమైన ప్రమాదం',
        expectedTempLabel: 'ఉష్ణోగ్రత',
        expectedWhyTitle: 'ఈ హెచ్చరిక ఎందుకు జారీ చేయబడింది',
        expectedActNowTitle: 'వ్యక్తిగతీకరించిన జాగ్రత్తలు',
        expectedReassessTitle: 'ఎప్పుడు తిరిగి సమీక్షించాలి',
        expectedEmergencyTitle: 'అత్యవసర వైద్య మార్గదర్శకం',
        expectedFooterDisclaimer: 'హీట్‌షీల్డ్ AI అనేది పర్యావరణ భద్రతా నిర్ణయ మద్దతు వ్యవస్థ మాత్రమే.',
      },
      {
        lang: 'ta',
        expectedLangCode: 'ta',
        expectedSubHeader: 'தற்போதைய வெப்ப அபாய எச்சரிக்கை',
        expectedGreetingPrefix: 'வணக்கம் Priya,',
        expectedRiskLabel: 'மிகக் கடுமையான',
        expectedTempLabel: 'வெப்பநிலை',
        expectedWhyTitle: 'இந்த எச்சரிக்கை ஏன் தூண்டப்பட்டது',
        expectedActNowTitle: 'தனிப்பயனாக்கப்பட்ட முன்னெச்சரிக்கைகள்',
        expectedReassessTitle: 'மீண்டும் எப்போது சரிபார்க்க வேண்டும்',
        expectedEmergencyTitle: 'அவசர மருத்துவ வழிகாட்டுதல்',
        expectedFooterDisclaimer: 'ஹீட்ஷீல்டு AI என்பது ஒரு பாதுகாப்பு வழிகாட்டுதல் திட்டம் மட்டுமே.',
      },
      {
        lang: 'hi',
        expectedLangCode: 'hi',
        expectedSubHeader: 'वर्तमान गर्मी जोखिम चेतावनी',
        expectedGreetingPrefix: 'नमस्ते Priya,',
        expectedRiskLabel: 'अत्यधिक गंभीर',
        expectedTempLabel: 'तापमान',
        expectedWhyTitle: 'यह चेतावनी क्यों जारी की गई',
        expectedActNowTitle: 'व्यक्तिगत सुरक्षा सावधानियां',
        expectedReassessTitle: 'कब पुनः मूल्यांकन करें',
        expectedEmergencyTitle: 'आपातकालीन चिकित्सा मार्गदर्शन',
        expectedFooterDisclaimer: 'हीटशील्ड AI एक पर्यावरणीय सुरक्षा निर्णय सहायता प्रणाली है।',
      },
    ];

    for (const tc of testCases) {
      it(`Renders 100% complete localized email for [${tc.lang.toUpperCase()}]`, () => {
        const precautionData = getPrecautions({
          temperature: 41.5,
          apparentTemperature: 47.2,
          humidity: 68,
          windSpeed: 4.5,
          activity: 'high',
          exposure: 'work',
          cooling: 'limited',
          riskScore: 92,
          riskLevel: 'EXTREME',
          language: tc.lang,
        });

        const rendered = getLocalizedAlertEmail({
          language: tc.lang,
          riskLevel: 'EXTREME',
          riskScore: 92,
          locationName: 'Vijayawada Thermal Zone',
          temperature: 41.5,
          apparentTemperature: 47.2,
          humidity: 68,
          windSpeed: 4.5,
          reasons: precautionData.reasons,
          precautions: precautionData.priority,
          recipientName: 'Priya',
          timestamp: '2026-10-06T06:00:00.000Z',
        });

        // 1. Subject line
        assert.ok(rendered.subject.includes(tc.expectedRiskLabel), `Subject contains localized risk label: ${rendered.subject}`);
        assert.ok(rendered.subject.includes('Vijayawada Thermal Zone'), 'Subject contains location name');

        // 2. HTML language tag
        assert.ok(rendered.html.includes(`<html lang="${tc.expectedLangCode}">`), `HTML has lang="${tc.expectedLangCode}"`);

        // 3. Greeting
        assert.ok(rendered.html.includes(tc.expectedGreetingPrefix), `Greeting contains localized prefix: ${tc.expectedGreetingPrefix}`);

        // 4. Subheader & Risk Level
        assert.ok(rendered.html.includes(tc.expectedSubHeader), `Subheader localized: ${tc.expectedSubHeader}`);
        assert.ok(rendered.html.includes(tc.expectedRiskLabel), `Risk label localized: ${tc.expectedRiskLabel}`);

        // 5. Current Conditions labels
        assert.ok(rendered.html.includes(tc.expectedTempLabel), `Temp label localized: ${tc.expectedTempLabel}`);
        assert.ok(rendered.html.includes('41.5°C'), 'Contains actual temperature value');
        assert.ok(rendered.html.includes('47.2°C'), 'Contains apparent temperature value');

        // 6. Why This Alert Was Triggered (reasons)
        assert.ok(rendered.html.includes(tc.expectedWhyTitle), `Why section header localized: ${tc.expectedWhyTitle}`);
        assert.ok(precautionData.reasons.length >= 2, 'Has at least 2 dynamic reasons');
        for (const reason of precautionData.reasons) {
          assert.ok(rendered.html.includes(reason), `HTML contains localized reason: ${reason}`);
        }

        // 7. Personalized Precautions
        assert.ok(rendered.html.includes(tc.expectedActNowTitle), `Precaution header localized: ${tc.expectedActNowTitle}`);
        assert.ok(precautionData.priority.length >= 3, 'Has at least 3 priority precautions');
        for (const prec of precautionData.priority.slice(0, 3)) {
          assert.ok(rendered.html.includes(prec), `HTML contains localized precaution: ${prec}`);
        }

        // 8. Reassessment Guidance
        assert.ok(rendered.html.includes(tc.expectedReassessTitle), `Reassess title localized: ${tc.expectedReassessTitle}`);

        // 9. Emergency Guidance
        assert.ok(rendered.html.includes(tc.expectedEmergencyTitle), `Emergency title localized: ${tc.expectedEmergencyTitle}`);

        // 10. Footer / Disclaimer / Settings
        assert.ok(rendered.html.includes(tc.expectedFooterDisclaimer), `Footer disclaimer localized: ${tc.expectedFooterDisclaimer}`);
        assert.ok(rendered.html.includes('https://heatshield-ai-kare.vercel.app/settings'), 'Footer contains settings link');

        // 11. Plain Text version contains all localized fields
        assert.ok(rendered.text.includes(tc.expectedGreetingPrefix), 'Plain text contains localized greeting');
        assert.ok(rendered.text.includes(tc.expectedRiskLabel), 'Plain text contains localized risk level');
        assert.ok(rendered.text.includes(tc.expectedWhyTitle), 'Plain text contains localized why section');
        assert.ok(rendered.text.includes(tc.expectedActNowTitle), 'Plain text contains localized precautions section');
      });
    }
  });

  // =========================================================================
  // 2. DYNAMIC PRECAUTIONS ENGINE VERIFICATION
  // =========================================================================
  describe('2. Dynamic Precaution Input Sensitivity', () => {
    it('A. Lower-risk conditions produce routine hydration & mild baseline reasons', () => {
      const p = getPrecautions({
        temperature: 26,
        apparentTemperature: 27,
        humidity: 45,
        windSpeed: 15,
        riskScore: 25,
        riskLevel: 'LOW',
        language: 'en',
      });
      assert.ok(p.priority.some((x) => x.includes('250-500ml of clean water regularly')), 'Routine hydration advice included');
      assert.ok(p.reasons.some((x) => x.includes('stable baseline limits')), 'Baseline reason included');
      assert.ok(!p.immediate.some((x) => x.includes('Cease heavy outdoor labor')), 'No extreme stoppage in low risk');
    });

    it('B. High humidity produces evaporative cooling restriction guidance', () => {
      const p = getPrecautions({
        temperature: 33,
        apparentTemperature: 41,
        humidity: 82,
        windSpeed: 8,
        riskScore: 72,
        riskLevel: 'HIGH',
        language: 'en',
      });
      assert.ok(p.priority.some((x) => x.includes('High humidity is suppressing sweat evaporation')), 'Includes evaporative sweat limitation advice');
      assert.ok(p.reasons.some((x) => x.includes('Relative humidity at 82% significantly limits natural sweat evaporation')), 'High humidity trigger cited in reasons');
    });

    it('C. Higher apparent temperature triggers urgent hydration', () => {
      const p = getPrecautions({
        temperature: 36,
        apparentTemperature: 45,
        humidity: 55,
        windSpeed: 5,
        riskScore: 85,
        riskLevel: 'EXTREME',
        language: 'en',
      });
      assert.ok(p.immediate.some((x) => x.includes('Increase fluid intake immediately')), 'Urgent hydration triggered by high apparent temp');
      assert.ok(p.reasons.some((x) => x.includes('Apparent temperature feels like 45°C')), 'Apparent temp cited in reasons');
    });

    it('D. Longer exposure triggers continuous outdoor limitation intervals', () => {
      const p = getPrecautions({
        temperature: 34,
        apparentTemperature: 37,
        humidity: 50,
        windSpeed: 10,
        exposure: 'work',
        riskScore: 60,
        riskLevel: 'MODERATE',
        language: 'en',
      });
      assert.ok(p.immediate.some((x) => x.includes('Limit continuous outdoor exposure to 20-30 minute intervals')), 'Exposure interval limitation triggered');
      assert.ok(p.reasons.some((x) => x.includes('Continuous outdoor presence accumulates dangerous thermal load')), 'Exposure cited in reasons');
    });

    it('E. Heavy physical activity triggers exertion reduction / stoppage', () => {
      const p = getPrecautions({
        temperature: 37,
        apparentTemperature: 42,
        humidity: 50,
        windSpeed: 8,
        activity: 'very_high',
        riskScore: 88,
        riskLevel: 'EXTREME',
        language: 'en',
      });
      assert.ok(p.immediate.some((x) => x.includes('Cease heavy outdoor labor during peak thermal hours')), 'Heavy labor cessation triggered');
      assert.ok(p.reasons.some((x) => x.includes('Physical exertion accelerates internal metabolic heat generation')), 'Metabolic heat cited in reasons');
    });

    it('F. Limited cooling access triggers cooling shelter identification', () => {
      const p = getPrecautions({
        temperature: 34,
        apparentTemperature: 38,
        humidity: 55,
        windSpeed: 6,
        cooling: 'none',
        riskScore: 65,
        riskLevel: 'HIGH',
        language: 'en',
      });
      assert.ok(p.immediate.some((x) => x.includes('locate the nearest public cooling center')), 'Cooling shelter advice triggered');
      assert.ok(p.reasons.some((x) => x.includes('Restricted access to air conditioning or fan cooling')), 'Cooling access cited in reasons');
    });

    it('G. Risk escalation in hourly forecast triggers upcoming warning', () => {
      const p = getPrecautions({
        temperature: 32,
        apparentTemperature: 35,
        humidity: 50,
        windSpeed: 10,
        riskScore: 45,
        riskLevel: 'MODERATE',
        forecast: [
          { time: '2026-10-06T12:00:00Z', temperature: 38, apparentTemperature: 44, riskScore: 82, riskLevel: 'EXTREME' }
        ],
        language: 'en',
      });
      assert.ok(p.upcoming.length > 0, 'Forecast escalation warning produced');
      assert.ok(p.upcoming.some((x) => x.includes('escalate to EXTREME')), 'Forecast warning mentions EXTREME escalation');
    });
  });

  // =========================================================================
  // 3. ARCHITECTURE & USER SECURITY: NO GMAIL OAUTH FOR NORMAL USERS
  // =========================================================================
  describe('3. Architecture & User Security Boundaries', () => {
    it('Resend is the active default provider and recognizes SANDBOX mode', async () => {
      const origKey = process.env.RESEND_API_KEY;
      const origFrom = process.env.EMAIL_FROM;
      process.env.RESEND_API_KEY = 're_test_dummy_key_12345';
      process.env.EMAIL_FROM = 'HeatShield Alerts <onboarding@resend.dev>';

      const status = await getEmailServiceStatus();
      assert.equal(status.provider, 'resend');
      assert.equal(status.mode, 'SANDBOX');
      assert.equal(status.ready, true);
      assert.equal(status.domain, 'resend.dev');
      assert.equal(status.domainVerified, false);
      assert.match(status.message, /Resend sandbox mode/i);

      process.env.RESEND_API_KEY = origKey;
      process.env.EMAIL_FROM = origFrom;
    });

    it('Evaluates production domain vs sandbox without fabricating verified sender', async () => {
      const origKey = process.env.RESEND_API_KEY;
      const origFrom = process.env.EMAIL_FROM;
      process.env.RESEND_API_KEY = 're_test_dummy_key_12345';
      process.env.EMAIL_FROM = 'alerts@unverified-heatshield-domain.org';

      const status = await getEmailServiceStatus();
      // Since unverified domain without Resend verification, mode is NOT_READY
      assert.equal(status.mode, 'NOT_READY');
      assert.equal(status.domainVerified, false);
      assert.match(status.message, /not verified|Unable to verify domain status/i);

      process.env.RESEND_API_KEY = origKey;
      process.env.EMAIL_FROM = origFrom;
    });

    it('Adapts legacy SendEmailOptions to authoritative localized template without losing language', () => {
      const smartAlert: SmartAlert = {
        id: 'test_alert_te_1',
        rule_id: 'CURRENT_EXTREME',
        priority: 'CRITICAL',
        title: 'హీట్‌షీల్డ్ హెచ్చరిక',
        message: 'తీవ్రమైన వేడి హెచ్చరిక',
        timestamp: new Date().toISOString(),
        dismissed: false,
        read: false,
        dedup_key: 'test_te_1',
        trigger_data: {
          temperature: 42,
          apparent_temperature: 48,
          humidity: 60,
          wind_speed: 5,
          risk_score: 95,
          risk_level: 'EXTREME',
        },
      };

      const rendered = generateEmailContent({
        to: 'user@example.com',
        alert: smartAlert,
        language: 'te',
        locationName: 'హైదరాబాద్',
        recipientName: 'రమేష్',
      });

      assert.ok(rendered.subject.includes('హీట్‌షీల్డ్ AI'), 'Subject is in Telugu');
      assert.ok(rendered.html.includes('నమస్కారం రమేష్,'), 'Greeting is in Telugu');
      assert.ok(rendered.html.includes('తీవ్రమైన ప్రమాదం'), 'Risk level is in Telugu');
      assert.ok(rendered.html.includes('హైదరాబాద్'), 'Location is in Telugu');
      assert.ok(rendered.html.includes('ఉష్ణోగ్రత'), 'Weather label is in Telugu');
    });
  });
});
