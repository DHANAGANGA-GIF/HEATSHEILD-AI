'use client';

import React, { useState } from 'react';
import { Mail, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { getAlertSettings, saveAlertSettings, getUserProfile, saveUserProfile } from '@/lib/store';
import { AlertSettings, SmartAlert } from '@/lib/types';

export function EmailPreferenceToggle() {
  const [settings, setSettings] = useState<AlertSettings>(getAlertSettings());
  const [profile, setProfile] = useState(getUserProfile());
  const [emailInput, setEmailInput] = useState(profile.email || '');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleToggle = (enabled: boolean) => {
    const updated = saveAlertSettings({ email_notifications_enabled: enabled });
    setSettings(updated);
    if (emailInput) {
      saveUserProfile({ email: emailInput });
    }
  };

  const handleSaveEmail = () => {
    if (emailInput && emailInput.includes('@')) {
      const updatedProfile = saveUserProfile({ email: emailInput });
      setProfile(updatedProfile);
      setTestResult({ success: true, message: 'Email address saved successfully.' });
    } else {
      setTestResult({ success: false, message: 'Please enter a valid email address.' });
    }
  };

  const handleSendTestEmail = async () => {
    const targetEmail = emailInput || profile.email;
    if (!targetEmail || !targetEmail.includes('@')) {
      setTestResult({ success: false, message: 'Please enter a valid email address first.' });
      return;
    }

    setSendingTest(true);
    setTestResult(null);

    const testAlert: SmartAlert = {
      id: `test_alert_${Date.now()}`,
      rule_id: 'CURRENT_EXTREME',
      priority: 'CRITICAL',
      title: 'HeatShield Test Email Alert',
      message: 'This is an official transactional test alert verifying Resend integration for HeatShield AI.',
      trigger_data: {
        risk_score: 85,
        risk_level: 'EXTREME',
        temperature: 41,
        apparent_temperature: 46,
        humidity: 68,
        wind_speed: 12,
      },
      recommended_action: 'Resend delivery operational. Take shade, stay hydrated, and limit outdoor labor.',
      source_status: 'LIVE',
      timestamp: new Date().toISOString(),
      dismissed: false,
      read: false,
      dedup_key: `TEST_${Date.now()}`,
      location_name: profile.location?.name || 'Chennai',
    };

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined') {
        const storedAuth = localStorage.getItem('sb-auth-token') || localStorage.getItem('supabase.auth.token');
        if (storedAuth) {
          try {
            const parsed = JSON.parse(storedAuth);
            if (parsed?.access_token) {
              headers['Authorization'] = `Bearer ${parsed.access_token}`;
            }
          } catch {}
        }
      }

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: targetEmail,
          alert: testAlert,
          locationName: testAlert.location_name,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, message: `Email dispatched via Resend! ID: ${data.id || 'accepted'}` });
      } else {
        setTestResult({ success: false, message: data.error || 'Failed to send test email via Resend.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Network error attempting email dispatch.' });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Email Notifications (Resend API)</h4>
            <p className="text-xs text-slate-400">Receive transactional heat risk alerts delivered to your inbox</p>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={!!settings.email_notifications_enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {settings.email_notifications_enabled && (
        <div className="pt-2 border-t border-slate-800/80 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="email"
              placeholder="Enter email address (e.g. user@example.com)"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />
            <button
              onClick={handleSaveEmail}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-xl transition"
            >
              Save Address
            </button>
            <button
              onClick={handleSendTestEmail}
              disabled={sendingTest}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white rounded-xl transition flex items-center justify-center gap-2 shrink-0"
            >
              {sendingTest ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Email</span>
                </>
              )}
            </button>
          </div>

          {testResult && (
            <div className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
              testResult.success 
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' 
                : 'bg-red-950/40 border-red-800/60 text-red-300'
            }`}>
              {testResult.success ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
