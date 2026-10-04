'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AssistantMessage, generateAssistantResponse, SUGGESTED_QUESTIONS } from '@/lib/ai-assistant';
import { Language, RiskAssessment, TechMode, WeatherData } from '@/lib/types';
import { t } from '@/lib/i18n';
import { MessageSquare, Send, ShieldAlert, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

interface AiAssistantProps {
  weather?: WeatherData | null;
  risk?: RiskAssessment | null;
  mode?: TechMode;
  onModeChange?: (mode: TechMode) => void;
  lang?: Language;
  className?: string;
}

export function AiAssistant({
  weather,
  risk,
  mode: externalMode,
  onModeChange,
  lang = 'en',
  className = '',
}: AiAssistantProps) {
  const [internalMode, setInternalMode] = useState<TechMode>('technical');
  const activeMode = externalMode || internalMode;

  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleToggleMode = (newMode: TechMode) => {
    if (onModeChange) {
      onModeChange(newMode);
    } else {
      setInternalMode(newMode);
    }
  };

  useEffect(() => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (weather && risk) {
      setMessages([
        {
          id: 'welcome',
          sender: 'assistant',
          text: `CURRENT CONDITIONS
→ It is ${weather.temperature}°C (feels like ${weather.apparent_temperature}°C) with ${weather.relative_humidity}% humidity in ${weather.location?.name || 'your area'}.

RISK
→ Heat Risk Level: ${risk.risk_level} (${risk.risk_score}/100)

DATA STATUS
→ ${weather.is_cached ? 'CACHED' : 'LIVE'}

Welcome to HeatShield AI Safety Assistant. Ask any safety question or select a suggested prompt below.`,
          timestamp: timeStr,
          data_status: weather.is_cached ? 'CACHED' : 'LIVE',
        },
      ]);
    } else {
      setMessages([
        {
          id: 'welcome_nodata',
          sender: 'assistant',
          text: `CURRENT CONDITIONS
→ Environmental observation data unavailable.

RISK
→ Risk level pending weather data.

DATA STATUS
→ UNAVAILABLE

Welcome to HeatShield AI. Environmental data is loading or unavailable. Ask general safety questions below.`,
          timestamp: timeStr,
          data_status: 'UNAVAILABLE',
        },
      ]);
    }
  // Stable primitive selectors (weather?.timestamp, risk?.risk_score) are used intentionally
  // instead of the full `weather`/`risk` objects to prevent infinite re-renders — the objects
  // are recreated on each parent render. Adding them directly would violate correctness.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather?.timestamp, risk?.risk_score]);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query) return;

    setErrorMessage(null);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: AssistantMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: timeStr,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputQuery('');
    setIsLoading(true);

    // Simulate async processing
    setTimeout(() => {
      try {
        const botMsg = generateAssistantResponse(query, risk, weather, activeMode);
        setMessages((prev) => [...prev, botMsg]);
      } catch (err: any) {
        setErrorMessage('Failed to generate assistant response. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }, 250);
  };

  const dataStatus = !weather || !risk ? 'UNAVAILABLE' : weather.is_cached ? 'CACHED' : 'LIVE';

  return (
    <div className={`bg-slate-900 rounded-xl border border-slate-800 shadow-xs flex flex-col h-full overflow-hidden ${className}`}>
      {/* Assistant Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              HEATSHIELD AI ASSISTANT
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Context-Aware Decision Support
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Data Status Badge */}
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              dataStatus === 'LIVE'
                ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800'
                : dataStatus === 'CACHED'
                ? 'bg-amber-950/50 text-amber-300 border-amber-800'
                : 'bg-rose-950/50 text-rose-300 border-rose-800'
            }`}
          >
            STATUS: {dataStatus}
          </span>

          {/* Mode Toggle */}
          <div className="flex items-center bg-slate-800 p-0.5 rounded-lg text-[11px] font-medium border border-slate-700">
            <button
              onClick={() => handleToggleMode('simple')}
              className={`px-2 py-0.5 rounded-md transition ${
                activeMode === 'simple' ? 'bg-slate-700 text-white shadow-2xs font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('simple', lang)}
            </button>
            <button
              onClick={() => handleToggleMode('technical')}
              className={`px-2 py-0.5 rounded-md transition ${
                activeMode === 'technical' ? 'bg-slate-700 text-white shadow-2xs font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('technical', lang)}
            </button>
          </div>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="bg-amber-950/30 border-b border-amber-900/50 px-4 py-2 flex items-center gap-2 text-[11px] text-amber-300 font-medium">
        <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <span>
          <strong>Safety Notice:</strong> HeatShield AI provides preventive guidance and is <strong>not a medical diagnosis tool</strong>. For emergencies, call local emergency response.
        </span>
      </div>

      {/* Context Card (if weather & risk available) */}
      {weather && risk && (
        <div className="mx-4 mt-3 p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-200">{weather.location?.name}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300">{weather.temperature}°C (Feels {weather.apparent_temperature}°C)</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300">RH {weather.relative_humidity}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Risk:</span>
            <span
              className={`font-bold px-1.5 py-0.5 rounded border text-[11px] ${
                risk.risk_level === 'EXTREME'
                  ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                  : risk.risk_level === 'HIGH'
                  ? 'bg-orange-950/60 text-orange-300 border-orange-800'
                  : risk.risk_level === 'MODERATE'
                  ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
              }`}
            >
              {risk.risk_level} ({risk.risk_score}/100)
            </span>
          </div>
        </div>
      )}

      {/* Suggested Question Chips */}
      <div className="px-4 pt-3 flex flex-wrap gap-1.5">
        {SUGGESTED_QUESTIONS.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            disabled={isLoading}
            className="text-[11px] bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700/80 px-2.5 py-1 rounded-md transition font-medium text-left"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Messages Scrollable Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[250px]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-xl p-3.5 rounded-xl text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-emerald-600 text-white font-medium'
                  : msg.is_emergency_warning
                  ? 'bg-rose-950/50 border border-rose-800 text-rose-200 font-medium'
                  : 'bg-slate-800 border border-slate-700/80 text-slate-100'
              }`}
            >
              <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
              <div className="mt-2 flex items-center justify-between text-[10px] opacity-70 font-mono border-t border-slate-700/50 pt-1 text-slate-400">
                <span>{msg.data_status ? `[DATA: ${msg.data_status}]` : ''}</span>
                <span>{msg.timestamp}</span>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono p-2 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            <span>Analyzing application context & generating guidance...</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Query Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 border-t border-slate-800 bg-slate-950/80 flex gap-2"
      >
        <input
          type="text"
          placeholder="Ask a question about your heat risk, guidance, or peak hours..."
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          disabled={isLoading}
          className="flex-1 bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 text-xs rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !inputQuery.trim()}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow-xs transition"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
