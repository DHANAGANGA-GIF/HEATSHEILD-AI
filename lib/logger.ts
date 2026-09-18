/**
 * HeatShield AI — Privacy-Preserving Observability Logger
 *
 * Provides structured telemetry for latency, error rates, and model inference
 * strictly WITHOUT logging Personally Identifiable Information (PII), raw user
 * coordinates, credentials, or API secrets.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogPayload {
  event: string;
  level?: LogLevel;
  duration_ms?: number;
  model_version?: string;
  source_status?: string;
  status_code?: number;
  error_code?: string;
  error_message?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

class ObservabilityLogger {
  private isServer = typeof window === 'undefined';
  private isDev = process.env.NODE_ENV !== 'production';

  private sanitize(payload: LogPayload): LogPayload {
    const clean: LogPayload = {
      event: payload.event,
      level: payload.level || 'info',
      duration_ms: payload.duration_ms,
      model_version: payload.model_version,
      source_status: payload.source_status,
      status_code: payload.status_code,
      error_code: payload.error_code,
      error_message: payload.error_message,
      metadata: {},
    };

    if (payload.metadata) {
      for (const [k, v] of Object.entries(payload.metadata)) {
        // Redact any accidental credential/PII keys
        const lower = k.toLowerCase();
        if (
          lower.includes('token') ||
          lower.includes('secret') ||
          lower.includes('key') ||
          lower.includes('password') ||
          lower.includes('email') ||
          lower.includes('phone') ||
          lower.includes('authorization')
        ) {
          clean.metadata![k] = '[REDACTED]';
        } else {
          clean.metadata![k] = v;
        }
      }
    }

    return clean;
  }

  info(event: string, meta?: Partial<LogPayload>): void {
    const payload = this.sanitize({ event, level: 'info', ...meta });
    if (this.isDev) {
      console.log(`[HeatShield:INFO] ${event}`, payload);
    } else {
      console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...payload }));
    }
  }

  warn(event: string, meta?: Partial<LogPayload>): void {
    const payload = this.sanitize({ event, level: 'warn', ...meta });
    if (this.isDev) {
      console.warn(`[HeatShield:WARN] ${event}`, payload);
    } else {
      console.warn(JSON.stringify({ timestamp: new Date().toISOString(), ...payload }));
    }
  }

  error(event: string, error?: Error | unknown, meta?: Partial<LogPayload>): void {
    const errMessage = error instanceof Error ? error.message : String(error || '');
    const payload = this.sanitize({
      event,
      level: 'error',
      error_message: errMessage,
      ...meta,
    });
    if (this.isDev) {
      console.error(`[HeatShield:ERROR] ${event}`, payload);
    } else {
      console.error(JSON.stringify({ timestamp: new Date().toISOString(), ...payload }));
    }
  }

  trackInference(durationMs: number, score: number, level: string, modelVersion: string): void {
    this.info('ml_inference_completed', {
      duration_ms: durationMs,
      model_version: modelVersion,
      metadata: {
        risk_score: score,
        risk_level: level,
      },
    });
  }

  trackWeatherFetch(source: string, durationMs: number, success: boolean): void {
    if (success) {
      this.info('weather_fetch_success', {
        duration_ms: durationMs,
        source_status: source,
      });
    } else {
      this.warn('weather_fetch_degraded', {
        duration_ms: durationMs,
        source_status: source,
      });
    }
  }
}

export const logger = new ObservabilityLogger();
