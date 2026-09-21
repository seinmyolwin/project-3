/**
 * ============================================================================
 * PHASE 22: PRODUCTION RUNTIME LOGGER
 * ============================================================================
 * Writes structured operational logs to both console and data/logs/app.log.
 * Automatically sanitizes passwords, PINs, JWT secrets, and payment tokens.
 */

import fs from 'fs';
import path from 'path';
import { runtimeConfig } from './config';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

class ProductionLogger {
  private logFilePath: string;

  constructor() {
    this.logFilePath = path.join(runtimeConfig.logsDir, 'app.log');
  }

  private sanitize(data: any): any {
    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') return data;

    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }

    const sanitized: Record<string, any> = {};
    const sensitiveKeys = ['password', 'password_hash', 'pin', 'salt', 'token', 'authorization', 'secret', 'jwt'];

    for (const [key, val] of Object.entries(data)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof val === 'object') {
        sanitized[key] = this.sanitize(val);
      } else {
        sanitized[key] = val;
      }
    }

    return sanitized;
  }

  private write(level: LogLevel, context: string, message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    const sanitizedMeta = meta ? this.sanitize(meta) : undefined;
    const metaStr = sanitizedMeta ? ` | ${JSON.stringify(sanitizedMeta)}` : '';
    const formattedLine = `[${timestamp}] [${level}] [${context}] ${message}${metaStr}\n`;

    // Console output
    if (level === 'ERROR' || level === 'FATAL') {
      console.error(formattedLine.trimEnd());
    } else if (level === 'WARN') {
      console.warn(formattedLine.trimEnd());
    } else {
      console.log(formattedLine.trimEnd());
    }

    // Disk file append
    try {
      if (!fs.existsSync(runtimeConfig.logsDir)) {
        fs.mkdirSync(runtimeConfig.logsDir, { recursive: true });
      }
      fs.appendFileSync(this.logFilePath, formattedLine, 'utf8');
    } catch {
      // Avoid crash on log write failure
    }
  }

  public debug(context: string, message: string, meta?: any): void {
    if (runtimeConfig.env !== 'production') {
      this.write('DEBUG', context, message, meta);
    }
  }

  public info(context: string, message: string, meta?: any): void {
    this.write('INFO', context, message, meta);
  }

  public warn(context: string, message: string, meta?: any): void {
    this.write('WARN', context, message, meta);
  }

  public error(context: string, message: string, meta?: any): void {
    this.write('ERROR', context, message, meta);
  }

  public fatal(context: string, message: string, meta?: any): void {
    this.write('FATAL', context, message, meta);
  }

  public getRecentLogs(limit = 100): string[] {
    try {
      if (!fs.existsSync(this.logFilePath)) return [];
      const content = fs.readFileSync(this.logFilePath, 'utf8');
      const lines = content.trim().split('\n');
      return lines.slice(-limit);
    } catch {
      return [];
    }
  }
}

export const logger = new ProductionLogger();
