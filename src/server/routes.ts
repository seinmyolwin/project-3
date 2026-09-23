/**
 * ============================================================================
 * SERVER ROUTES & FINANCIAL CONTROLLERS
 * ============================================================================
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import { PersistentSQLiteStorage, serverStorage } from './storage';
import { ServerAuthSession, ServerUserEntity } from './types';
import { UserRole, APP_VERSION, APP_BUILD_DATE, UPDATE_MODE } from '../types';
import { realtimeEventBus } from './realtime/eventBus';
import { healthManager } from './health';
import { logger } from './logger';
import { runtimeConfig } from './config';

export const activeSessions = new Map<string, ServerAuthSession>();

export function createApiRouter(storage: PersistentSQLiteStorage = serverStorage): Router {
  const router = Router();

  // Middleware: Attach DB ensure ready
  router.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      await storage.initialize();
      next();
    } catch (err: any) {
      logger.error('Routes', 'Database initialization error on request', { error: err.message });
      res.status(500).json({ error: 'DATABASE_INITIALIZATION_ERROR', message: err.message });
    }
  });

  // Auth Middleware
  function requireAuth(allowedRoles?: UserRole[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header' });
      }

      const token = authHeader.substring(7);
      const session = activeSessions.get(token);

      if (!session) {
        return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Session token is invalid or expired' });
      }

      if (Date.now() > session.expiresAt) {
        activeSessions.delete(token);
        return res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'Session expired' });
      }

      // Check device revocation
      const device = storage.getDevice(session.deviceId);
      if (device && device.status === 'REVOKED') {
        return res.status(403).json({ error: 'DEVICE_REVOKED', message: 'This device access has been revoked.' });
      }

      // Role check
      if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.user.role)) {
        return res.status(403).json({
          error: 'FORBIDDEN_ROLE',
          message: `Role '${session.user.role}' is not authorized for this operation. Requires one of: ${allowedRoles.join(', ')}`,
        });
      }

      (req as any).user = session.user;
      (req as any).deviceId = session.deviceId;
      (req as any).token = token;
      next();
    };
  }

  // ==========================================
  // 1. HEALTH & METADATA
  // ==========================================
  router.get('/health', (req: Request, res: Response) => {
    const health = healthManager.getHealth(storage.isReady(), storage.getDatabasePath());
    res.json(health);
  });

  // ==========================================
  // 2. AUTHENTICATION
  // ==========================================
  router.post('/auth/login', (req: Request, res: Response) => {
    const { username, password, deviceId } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'Username and password are required' });
    }

    const user = storage.authenticateUser(username, password);
    if (!user) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid username or password' });
    }

    const targetDeviceId = deviceId || 'DEV_GUEST';
    const device = storage.getDevice(targetDeviceId);
    if (device && device.status === 'REVOKED') {
      return res.status(403).json({ error: 'DEVICE_REVOKED', message: 'This device is revoked from shop network.' });
    }

    const token = 'lan_tok_' + crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    activeSessions.set(token, {
      token,
      user,
      deviceId: targetDeviceId,
      expiresAt,
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        businessId: user.businessId,
        branchId: user.branchId,
      },
      expiresAt: new Date(expiresAt).toISOString(),
    });
  });

  router.post('/auth/logout', requireAuth(), (req: Request, res: Response) => {
    const token = (req as any).token;
    activeSessions.delete(token);
    res.json({ success: true, message: 'Logged out successfully' });
  });

  router.get('/auth/me', requireAuth(), (req: Request, res: Response) => {
    res.json({
      user: (req as any).user,
      deviceId: (req as any).deviceId,
    });
  });

  // ==========================================
  // 3. DEVICE PAIRING & REGISTRATION
  // ==========================================
  router.post('/devices/register', (req: Request, res: Response) => {
    const { deviceId, businessId, branchId, deviceName, deviceRole, appVersion, databaseVersion } = req.body;
    if (!deviceId || !businessId || !branchId) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'deviceId, businessId, and branchId are required' });
    }

    // Business Isolation Check
    const biz = storage.getBusiness(businessId);
    if (!biz) {
      return res.status(404).json({ error: 'BUSINESS_NOT_FOUND', message: `Business '${businessId}' does not exist` });
    }

    const registered = storage.registerDevice({
      deviceId,
      businessId,
      branchId,
      deviceName: deviceName || `Device ${deviceId}`,
      deviceRole: deviceRole || 'CASHIER',
      appVersion: appVersion || '1.0.0',
      databaseVersion: Number(databaseVersion) || 3,
    });

    res.json({ success: true, device: registered });
  });

  router.post('/devices/pair', (req: Request, res: Response) => {
    const { deviceId, pairingCode, deviceInfo } = req.body;
    if (!deviceId || !pairingCode) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'deviceId and pairingCode are required' });
    }

    const result = storage.pairDevice(deviceId, pairingCode, deviceInfo || {});
    if (!result.success) {
      return res.status(400).json({ error: 'PAIRING_FAILED', message: result.message });
    }

    res.json({ success: true, message: result.message, device: result.device });
  });

  router.post('/devices/pairing-codes', requireAuth(['owner', 'manager']), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const { roleAllowed, expiresInMinutes } = req.body;

    const code = storage.createPairingCode(
      user.businessId,
      user.branchId,
      roleAllowed || 'CASHIER',
      user.username,
      Number(expiresInMinutes) || 60
    );

    res.json({
      success: true,
      pairingCode: code,
      expiresInMinutes: Number(expiresInMinutes) || 60,
      roleAllowed: roleAllowed || 'CASHIER',
    });
  });

  router.get('/devices/list', requireAuth(['owner', 'manager']), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const devices = storage.getAllRegisteredDevices(user.businessId);
    res.json({ success: true, count: devices.length, devices });
  });

  router.put('/devices/:deviceId/status', requireAuth(['owner', 'manager']), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const { deviceId } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'REVOKED', 'PENDING'].includes(status)) {
      return res.status(400).json({ error: 'INVALID_STATUS', message: 'Status must be ACTIVE, REVOKED, or PENDING' });
    }

    const device = storage.getDevice(deviceId);
    if (!device || device.businessId !== user.businessId) {
      return res.status(404).json({ error: 'DEVICE_NOT_FOUND', message: `Device ${deviceId} not found` });
    }

    storage.updateDeviceStatus(deviceId, status);

    // If revoked, disconnect all active WebSocket connections for this device immediately
    if (status === 'REVOKED') {
      realtimeEventBus.revokeDeviceConnections(deviceId);
    }

    res.json({ success: true, deviceId, status });
  });

  // ==========================================
  // 4. FINANCIAL SERVER OPERATION BOUNDARY
  // ==========================================
  router.post('/operations/process', requireAuth(), async (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const callerDeviceId = (req as any).deviceId as string;

    const {
      operationId,
      deviceId,
      businessId,
      branchId,
      operationType,
      entityType,
      entityId,
      payload,
    } = req.body;

    if (!operationId || !businessId || !branchId || !operationType || !payload) {
      return res.status(400).json({
        error: 'INVALID_OPERATION_PAYLOAD',
        message: 'operationId, businessId, branchId, operationType, and payload are required',
      });
    }

    // Business Isolation Guard
    if (user.businessId !== businessId) {
      return res.status(403).json({
        error: 'BUSINESS_ISOLATION_VIOLATION',
        message: `User is bound to business ${user.businessId}, but requested operation for ${businessId}`,
      });
    }

    // Branch Isolation Guard
    if (user.branchId !== branchId && user.role !== 'owner') {
      return res.status(403).json({
        error: 'BRANCH_ISOLATION_VIOLATION',
        message: `User is bound to branch ${user.branchId}, but requested operation for ${branchId}`,
      });
    }

    // Deterministic Canonical Hash
    const requestHash = storage.computeCanonicalHash(payload);
    const existing = storage.getIdempotencyRecord(operationId);

    if (existing) {
      if (existing.requestHash === requestHash) {
        // Safe Idempotent Replay
        return res.status(200).json({
          status: 'ALREADY_PROCESSED',
          operationId,
          result: existing.result,
          replayed: true,
          processedAt: existing.processedAt,
        });
      } else {
        // Conflicting Payload Reusing Same Operation ID
        return res.status(409).json({
          error: 'IDEMPOTENCY_CONFLICT',
          message: `Operation ${operationId} was already executed with a different request payload hash!`,
          existingHash: existing.requestHash,
          currentHash: requestHash,
        });
      }
    }

    const now = new Date().toISOString();

    try {
      let operationResult: any = null;

      // Real Operation Dispatching
      switch (operationType) {
        case 'SESSION_START': {
          operationResult = await storage.executeSessionStart({
            sessionId: entityId || payload.sessionId || `sess_${Date.now()}`,
            businessId,
            branchId,
            roomId: payload.roomId,
            customerName: payload.customerName,
            hourlyRateMMK: Number(payload.hourlyRateMMK) || 0,
            userId: user.id,
          });
          break;
        }

        case 'SESSION_END': {
          operationResult = await storage.executeSessionEnd({
            sessionId: entityId || payload.sessionId,
            businessId,
            branchId,
            roomId: payload.roomId,
            totalFeeMMK: Number(payload.totalFeeMMK) || 0,
            userId: user.id,
          });
          break;
        }

        case 'PAYMENT': {
          operationResult = await storage.executePayment({
            invoiceId: entityId || payload.invoiceId || `inv_${Date.now()}`,
            businessId,
            branchId,
            invoiceNumber: payload.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
            subtotalMMK: Number(payload.subtotalMMK) || 0,
            discountMMK: Number(payload.discountMMK) || 0,
            totalMMK: Number(payload.totalMMK) || 0,
            paidMMK: Number(payload.paidMMK) || 0,
            paymentMethod: payload.paymentMethod || 'cash',
            customerId: payload.customerId,
          });
          break;
        }

        case 'EXPENSE': {
          operationResult = await storage.executeExpense({
            expenseId: entityId || payload.expenseId || `exp_${Date.now()}`,
            businessId,
            branchId,
            category: payload.category || 'General',
            description: payload.description || 'Shop expense',
            amountMMK: Number(payload.amountMMK) || 0,
            paymentMethod: payload.paymentMethod || 'cash',
            createdBy: user.name,
          });
          break;
        }

        case 'CUSTOMER_CREDIT': {
          operationResult = await storage.executeCustomerCredit({
            ledgerId: payload.ledgerId || `cldg_${Date.now()}`,
            businessId,
            branchId,
            customerId: payload.customerId,
            amountMMK: Number(payload.amountMMK) || 0,
            notes: payload.notes,
          });
          break;
        }

        case 'CASH_CLOSING': {
          // Check role: Cashiers cannot close without manager/owner authorization
          if (user.role === 'receptionist') {
            return res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Receptionists cannot perform cash closing' });
          }
          operationResult = await storage.executeCashClosing({
            closingId: entityId || payload.closingId || `ccl_${Date.now()}`,
            businessId,
            branchId,
            date: payload.date || now.split('T')[0],
            openingCashMMK: Number(payload.openingCashMMK) || 0,
            cashSalesMMK: Number(payload.cashSalesMMK) || 0,
            debtRepaymentsMMK: Number(payload.debtRepaymentsMMK) || 0,
            cashExpensesMMK: Number(payload.cashExpensesMMK) || 0,
            actualCashMMK: Number(payload.actualCashMMK) || 0,
            closedBy: user.name,
          });
          break;
        }

        default: {
          operationResult = { executed: true, operationType, payload };
        }
      }

      // Record Idempotency Result
      storage.recordIdempotentOperation({
        operationId,
        deviceId: deviceId || callerDeviceId,
        businessId,
        branchId,
        operationType,
        entityType: entityType || 'GENERAL',
        entityId: entityId || 'N/A',
        requestHash,
        status: 'PROCESSED',
        result: operationResult,
        createdAt: now,
        processedAt: new Date().toISOString(),
      });

      // Record Server Audit Log
      storage.logAudit({
        businessId,
        branchId,
        userId: user.id,
        userName: user.name,
        deviceId: deviceId || callerDeviceId,
        action: operationType,
        entityType: entityType || 'GENERAL',
        entityId: entityId || 'N/A',
        reason: payload.reason || undefined,
        metadata: { requestHash, operationResult },
      });

      // Immediate drain of real-time outbox for connected clients
      realtimeEventBus.drainOutbox().catch(err => {
        console.warn('[Routes] Immediate outbox drain warning:', err.message);
      });

      return res.status(200).json({
        status: 'PROCESSED',
        operationId,
        result: operationResult,
        processedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      if (err.code === 'ROOM_OCCUPIED_CONFLICT' || err.code === 'DATE_ALREADY_CLOSED') {
        return res.status(409).json({ error: err.code, message: err.message });
      }
      if (err.code === 'CREDIT_LIMIT_EXCEEDED') {
        return res.status(422).json({ error: err.code, message: err.message });
      }
      return res.status(500).json({ error: 'OPERATION_EXECUTION_ERROR', message: err.message });
    }
  });

  // ==========================================
  // 5. REAL-TIME EVENT SYNC & PRESENCE
  // ==========================================
  router.post('/rooms/:roomId/reset', requireAuth(), async (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const { roomId } = req.params;
    await storage.resetRoomStatus(user.businessId, roomId);
    res.json({ success: true, message: `Room ${roomId} reset to available` });
  });

  router.get('/sync/events', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const sinceSequence = Number(req.query.sinceSequence) || 0;
    const branchId = (req.query.branchId as string) || user.branchId;
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    // Branch isolation guard
    if (branchId !== user.branchId && user.role !== 'owner') {
      return res.status(403).json({ error: 'BRANCH_ISOLATION_VIOLATION', message: 'Cannot query events for other branches' });
    }

    const events = storage.getOutboxEventsSince(user.businessId, branchId, sinceSequence, limit);
    const latestSequence = storage.getLatestSequence(user.businessId, branchId);

    res.json({
      success: true,
      businessId: user.businessId,
      branchId,
      sinceSequence,
      latestSequence,
      count: events.length,
      events,
    });
  });

  router.get('/sync/status', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const branchId = (req.query.branchId as string) || user.branchId;
    const latestSequence = storage.getLatestSequence(user.businessId, branchId);
    const pendingOutbox = storage.getPendingOutboxEvents(100).length;

    res.json({
      success: true,
      businessId: user.businessId,
      branchId,
      latestSequence,
      pendingOutboxCount: pendingOutbox,
      serverTime: new Date().toISOString(),
    });
  });

  router.get('/realtime/presence', requireAuth(['owner', 'manager']), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const clients = realtimeEventBus.getConnectedClients(user.businessId);
    res.json({
      success: true,
      businessId: user.businessId,
      onlineCount: clients.length,
      clients,
    });
  });

  // ==========================================
  // 6. AUDIT LOGS QUERY
  // ==========================================
  router.get('/audit/logs', requireAuth(['owner', 'manager']), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const logs = storage.getAuditLogs(user.businessId, user.role === 'owner' ? undefined : user.branchId);
    res.json({ success: true, count: logs.length, logs });
  });

  // ==========================================
  // 7. BACKUP & RESTORE & RUNTIME LOGS
  // ==========================================
  router.get('/system/backups', requireAuth(['owner', 'manager']), (req: Request, res: Response) => {
    try {
      const backups = storage.listBackups();
      res.json({ success: true, count: backups.length, backups, backupDir: runtimeConfig.backupDir });
    } catch (err: any) {
      res.status(500).json({ error: 'BACKUP_LIST_FAILED', message: err.message });
    }
  });

  router.post('/system/backup', requireAuth(['owner']), (req: Request, res: Response) => {
    try {
      const backupInfo = storage.createDefaultBackup();
      logger.info('Backup', `Created manual backup: ${backupInfo.fileName}`, { sizeBytes: backupInfo.sizeBytes });
      res.json({ success: true, backup: backupInfo, timestamp: new Date().toISOString() });
    } catch (err: any) {
      logger.error('Backup', 'Failed to create backup', { error: err.message });
      res.status(500).json({ error: 'BACKUP_FAILED', message: err.message });
    }
  });

  router.post('/system/restore', requireAuth(['owner']), (req: Request, res: Response) => {
    try {
      const { backupPath, fileName } = req.body;
      const targetPath = backupPath || (fileName ? path.join(runtimeConfig.backupDir, fileName) : null);
      if (!targetPath) {
        return res.status(400).json({ error: 'INVALID_REQUEST', message: 'backupPath or fileName is required' });
      }

      storage.restoreBackup(targetPath);
      logger.warn('Backup', `Database restored from backup: ${targetPath}`);
      res.json({ success: true, message: 'Database restored successfully', restoredFrom: targetPath, timestamp: new Date().toISOString() });
    } catch (err: any) {
      logger.error('Backup', 'Failed to restore backup', { error: err.message });
      res.status(500).json({ error: 'RESTORE_FAILED', message: err.message });
    }
  });

  router.get('/system/logs', requireAuth(['owner', 'manager']), (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const logs = logger.getRecentLogs(limit);
    res.json({ success: true, count: logs.length, logs });
  });

  // Offline-First Version & Update Information
  router.get('/system/update-info', (req: Request, res: Response) => {
    res.json({
      success: true,
      appName: runtimeConfig.appName,
      appVersion: APP_VERSION || runtimeConfig.appVersion,
      buildDate: APP_BUILD_DATE,
      updateMode: UPDATE_MODE,
      dataDirectory: runtimeConfig.dataDir,
      backupDirectory: runtimeConfig.backupDir,
      databasePath: storage.getDatabasePath(),
      schemaVersion: 3,
      isOfflineFirst: true,
      internetCheckingEnabled: false,
      updateSource: 'Local package / Manual host installation',
      notesMm: 'အင်တာနက် မလိုဘဲ စက်ထဲသို့ တိုက်ရိုက် မွမ်းမံမှု ပြုလုပ်နိုင်ပါသည်။ APP_DATA_DIR ရှိ ဒေတာများ လုံခြုံစွာ ထိန်းသိမ်းထားပါမည်။',
      notesEn: '100% offline-safe system. Updates are manually copied/extracted to the host without losing database records in APP_DATA_DIR.',
    });
  });

  // Pre-Update Automated Backup & Safety Check
  router.post('/system/pre-update-backup', requireAuth(['owner', 'manager']), (req: Request, res: Response) => {
    try {
      const backupInfo = storage.createDefaultBackup();
      logger.info('UpdateSystem', `Pre-update backup created before package migration: ${backupInfo.fileName}`, {
        sizeBytes: backupInfo.sizeBytes,
        dataDir: runtimeConfig.dataDir,
      });

      res.json({
        success: true,
        message: 'Pre-update database backup completed successfully.',
        backup: backupInfo,
        appVersion: APP_VERSION,
        dataDirectoryPreserved: true,
        schemaIdempotent: true,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      logger.error('UpdateSystem', 'Pre-update backup failed', { error: err.message });
      res.status(500).json({ error: 'PRE_UPDATE_BACKUP_FAILED', message: err.message });
    }
  });

  return router;
}
