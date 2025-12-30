/**
 * SECURITY: Admin Audit Logging
 */

import { getDatabaseClient } from "../config/database";

export interface AuditLogEntry {
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
}

export async function logAdminAction(entry: AuditLogEntry): Promise<void> {
  try {
    const client = getDatabaseClient();
    const now = Math.floor(Date.now() / 1000);
    const id = `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    await client.execute({
      sql: `
        INSERT INTO audit_logs (
          id, user_id, user_email, action, resource, resource_id,
          details, ip_address, user_agent, success,
          created_at, created_at_int
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `,
      args: [
        id,
        entry.userId,
        entry.userEmail,
        entry.action,
        entry.resource,
        entry.resourceId || null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ipAddress || null,
        entry.userAgent || null,
        entry.success ? 1 : 0,
        now,
      ],
    });

    console.log(`[AUDIT] ${entry.userEmail} - ${entry.action} ${entry.resource} ${entry.resourceId || ''} - ${entry.success ? 'SUCCESS' : 'FAILED'}`);
  } catch (error) {
    console.error('[AUDIT] Failed to log admin action:', error);
  }
}

export async function createAuditLogsTable(): Promise<void> {
  try {
    const client = getDatabaseClient();
    await client.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        resource_id TEXT,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        success INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at_int INTEGER
      )
    `);
    console.log('[AUDIT] Audit logs table ready');
  } catch (error) {
    console.error('[AUDIT] Failed to create audit_logs table:', error);
  }
}
