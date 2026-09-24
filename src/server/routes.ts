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

      // Check user active status in persistent database
      const freshUser = storage.getUserById(session.user.id);
      if (!freshUser || !freshUser.isActive) {
        activeSessions.delete(token);
        return res.status(401).json({ error: 'USER_DEACTIVATED', message: 'This user account is deactivated or removed' });
      }

      // Sync latest role & profile
      session.user.role = freshUser.role;
      session.user.name = freshUser.name;

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
  // 2. AUTHENTICATION & FIRST-RUN SETUP
  // ==========================================
  router.get('/auth/setup-status', (_req: Request, res: Response) => {
    const count = storage.countUsers();
    res.json({
      isSetupRequired: count === 0,
      userCount: count,
    });
  });

  router.post('/auth/setup-owner', (req: Request, res: Response) => {
    const count = storage.countUsers();
    if (count > 0) {
      return res.status(400).json({ error: 'SETUP_ALREADY_COMPLETED', message: 'Owner account is already configured' });
    }

    const { name, username, password } = req.body;
    if (!name || !username || !password || password.length < 4) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Name, username, and password (min 4 chars) are required' });
    }

    const owner = storage.createUser({
      name,
      username,
      role: 'owner',
      password,
    });

    res.json({
      success: true,
      message: 'Owner account created successfully',
      user: {
        id: owner.id,
        name: owner.name,
        username: owner.username,
        role: owner.role,
      },
    });
  });

  router.post('/setup-wizard', requireAuth(), async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || user.role !== 'owner') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only Shop Owner (owner role) can execute Setup Wizard',
      });
    }

    try {
      const payload = req.body || {};
      const result = await storage.replaceSetupWizardData({
        ...payload,
        businessId: user.businessId || 'default',
        branchId: user.branchId || 'main',
        userId: user.id,
        userName: user.name,
      });

      res.json({
        success: true,
        message: 'Master data setup successfully executed on server SQLite',
        backupFile: result.backupFile,
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'SETUP_FAILED',
        message: err.message || 'Failed to replace setup data',
      });
    }
  });

  router.post('/auth/pin-login', (req: Request, res: Response) => {
    const { usernameOrId, username, userId, pin, deviceId } = req.body;
    const accountLookup = (usernameOrId || username || userId || '').toString();
    const pinInput = (pin || '').toString();

    if (!accountLookup || !pinInput) {
      return res.status(400).json({ error: 'INVALID_REQUEST', message: 'User account and PIN are required' });
    }

    const user = storage.authenticateUserPin(accountLookup, pinInput);
    if (!user) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid account or PIN credential' });
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
      deviceId: targetDeviceId,
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
  // USER MANAGEMENT (OWNER ONLY RBAC)
  // ==========================================
  router.get('/users', requireAuth(['owner']), (_req: Request, res: Response) => {
    const users = storage.getUsers();
    res.json({
      success: true,
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
      })),
    });
  });

  router.post('/users', requireAuth(['owner']), (req: Request, res: Response) => {
    const { name, username, role, password, pin } = req.body;
    if (!name || !username) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Name and username are required' });
    }

    const existing = storage.getUserByUsername(username);
    if (existing) {
      return res.status(400).json({ error: 'USERNAME_EXISTS', message: 'Username is already in use' });
    }

    const validRoles: UserRole[] = ['owner', 'manager', 'cashier', 'receptionist'];
    const assignedRole = validRoles.includes(role) ? role : 'cashier';

    const created = storage.createUser({
      name,
      username,
      role: assignedRole,
      password: password || pin || '123456',
    });

    res.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: created.id,
        name: created.name,
        username: created.username,
        role: created.role,
        isActive: created.isActive,
        createdAt: created.createdAt,
      },
    });
  });

  router.put('/users/:id', requireAuth(['owner']), (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, username, role, isActive } = req.body;

    const user = storage.getUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    if (username && username.toLowerCase().trim() !== user.username.toLowerCase()) {
      const existing = storage.getUserByUsername(username);
      if (existing && existing.id !== id) {
        return res.status(400).json({ error: 'USERNAME_EXISTS', message: 'Username is already taken' });
      }
    }

    storage.updateUser(id, { name, username, role, isActive });
    const updated = storage.getUserById(id);

    res.json({
      success: true,
      message: 'User updated successfully',
      user: updated ? {
        id: updated.id,
        name: updated.name,
        username: updated.username,
        role: updated.role,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
      } : null,
    });
  });

  router.post('/users/:id/change-password', requireAuth(), (req: Request, res: Response) => {
    const { id } = req.params;
    const { newPassword } = req.body;
    const currentUser = (req as any).user;

    // Authorization: Owner can change any user password; normal user can only change own password
    if (currentUser.role !== 'owner' && currentUser.id !== id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only change your own password' });
    }

    if (!newPassword || newPassword.trim().length < 4) {
      return res.status(400).json({ error: 'INVALID_PASSWORD', message: 'Password must be at least 4 characters' });
    }

    const success = storage.updateUserPassword(id, newPassword.trim());
    if (!success) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    res.json({ success: true, message: 'Password updated successfully' });
  });

  router.post('/users/:id/toggle-active', requireAuth(['owner']), (req: Request, res: Response) => {
    const { id } = req.params;
    const { isActive } = req.body;
    const currentUser = (req as any).user;

    if (currentUser.id === id && !isActive) {
      return res.status(400).json({ error: 'CANNOT_DEACTIVATE_SELF', message: 'Owner cannot deactivate their own active account' });
    }

    const success = storage.setUserActive(id, Boolean(isActive));
    if (!success) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    // Invalidate sessions if deactivated
    if (!isActive) {
      for (const [tok, sess] of activeSessions.entries()) {
        if (sess.user.id === id) {
          activeSessions.delete(tok);
        }
      }
    }

    res.json({ success: true, message: `User ${isActive ? 'activated' : 'deactivated'} successfully` });
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

        case 'SESSION_EXTEND': {
          operationResult = await storage.executeSessionExtend({
            sessionId: entityId || payload.sessionId,
            businessId,
            branchId,
            extendedMinutes: Number(payload.extendedMinutes) || 0,
            extensionPriceMMK: Number(payload.extensionPriceMMK) || 0,
            reason: payload.reason,
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

        case 'SESSION_CANCEL':
        case 'SESSION_VOID': {
          if (user.role !== 'owner' && user.role !== 'manager') {
            return res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Only managers and owners can cancel or void sessions' });
          }
          operationResult = await storage.executeSessionCancel({
            sessionId: entityId || payload.sessionId,
            businessId,
            branchId,
            roomId: payload.roomId,
            reason: payload.reason,
            userId: user.id,
          });
          break;
        }

        case 'DIRECT_SALE':
        case 'SALE_CREATE': {
          operationResult = await storage.executeDirectSale({
            saleId: entityId || payload.saleId || `sale_${Date.now()}`,
            invoiceId: payload.invoiceId || `inv_${Date.now()}`,
            businessId,
            branchId,
            saleCode: payload.saleCode || `SL-${Date.now().toString().slice(-6)}`,
            invoiceNumber: payload.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
            sessionId: payload.sessionId,
            customerId: payload.customerId,
            customerName: payload.customerName,
            items: payload.items || [],
            subtotalMMK: Number(payload.subtotalMMK) || 0,
            discountMMK: Number(payload.discountMMK) || 0,
            taxMMK: Number(payload.taxMMK) || 0,
            totalMMK: Number(payload.totalMMK) || 0,
            paidMMK: Number(payload.paidMMK) || 0,
            paymentMethod: payload.paymentMethod || 'cash',
            userId: user.id,
            userName: user.name,
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

        case 'CUSTOMER_PAYMENT':
        case 'CUSTOMER_REPAYMENT': {
          operationResult = await storage.executeCustomerRepayment({
            ledgerId: payload.ledgerId || `cldg_${Date.now()}`,
            businessId,
            branchId,
            customerId: payload.customerId,
            amountMMK: Number(payload.amountMMK) || 0,
            paymentMethod: payload.paymentMethod || 'cash',
            notes: payload.notes,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'STAFF_ADVANCE': {
          operationResult = await storage.executeStaffAdvance({
            advanceId: payload.advanceId || `stadv_${Date.now()}`,
            businessId,
            branchId,
            staffId: payload.staffId,
            amountMMK: Number(payload.amountMMK) || 0,
            notes: payload.notes,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'STAFF_SETTLEMENT': {
          if (user.role !== 'owner' && user.role !== 'manager') {
            return res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Only managers and owners can execute staff settlements' });
          }
          operationResult = await storage.executeStaffSettlement({
            settlementId: entityId || payload.settlementId || `stset_${Date.now()}`,
            businessId,
            branchId,
            staffId: payload.staffId,
            settlementCode: payload.settlementCode || `SET-${Date.now().toString().slice(-6)}`,
            totalEarningsMMK: Number(payload.totalEarningsMMK) || 0,
            totalDeductionsMMK: Number(payload.totalDeductionsMMK) || 0,
            netPayoutMMK: Number(payload.netPayoutMMK) || 0,
            settledLedgerIds: payload.settledLedgerIds,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'STOCK_ADJUSTMENT': {
          if (user.role !== 'owner' && user.role !== 'manager') {
            return res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Only managers and owners can adjust stock' });
          }
          operationResult = await storage.executeStockAdjustment({
            productId: payload.productId,
            businessId,
            branchId,
            newStockQty: Number(payload.newStockQty) || 0,
            reason: payload.reason,
            userId: user.id,
          });
          break;
        }

        case 'CASH_CLOSING': {
          // Check role: Cashiers/Receptionists cannot close without manager/owner authorization
          if (user.role !== 'owner' && user.role !== 'manager') {
            return res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Only managers and owners can perform cash closing' });
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

        case 'BOOKING_CREATE': {
          operationResult = await storage.executeBookingCreate({
            bookingId: entityId || payload.bookingId || `bkg_${Date.now()}`,
            businessId,
            branchId,
            bookingCode: payload.bookingCode,
            customerId: payload.customerId,
            customerName: payload.customerName || 'Walk-in Guest',
            customerPhone: payload.customerPhone,
            serviceId: payload.serviceId,
            serviceName: payload.serviceName,
            roomId: payload.roomId,
            roomName: payload.roomName,
            staffId: payload.staffId,
            staffName: payload.staffName,
            date: payload.date,
            startTime: payload.startTime,
            endTime: payload.endTime,
            durationMinutes: Number(payload.durationMinutes) || 60,
            price: Number(payload.price) || 0,
            discount: Number(payload.discount) || 0,
            finalAmount: payload.finalAmount !== undefined ? Number(payload.finalAmount) : undefined,
            status: payload.status,
            notes: payload.notes,
            depositAmountMMK: Number(payload.depositAmountMMK) || 0,
            depositPaymentMethod: payload.depositPaymentMethod,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'BOOKING_UPDATE': {
          operationResult = await storage.executeBookingUpdate({
            bookingId: entityId || payload.bookingId,
            businessId,
            branchId,
            customerName: payload.customerName,
            customerPhone: payload.customerPhone,
            serviceId: payload.serviceId,
            serviceName: payload.serviceName,
            roomId: payload.roomId,
            roomName: payload.roomName,
            staffId: payload.staffId,
            staffName: payload.staffName,
            date: payload.date,
            startTime: payload.startTime,
            endTime: payload.endTime,
            durationMinutes: Number(payload.durationMinutes) || 60,
            price: payload.price !== undefined ? Number(payload.price) : undefined,
            discount: payload.discount !== undefined ? Number(payload.discount) : undefined,
            finalAmount: payload.finalAmount !== undefined ? Number(payload.finalAmount) : undefined,
            notes: payload.notes,
            status: payload.status,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'BOOKING_CONFIRM': {
          operationResult = await storage.executeBookingConfirm({
            bookingId: entityId || payload.bookingId,
            businessId,
            branchId,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'BOOKING_CANCEL': {
          operationResult = await storage.executeBookingCancel({
            bookingId: entityId || payload.bookingId,
            businessId,
            branchId,
            cancellationReason: payload.cancellationReason || payload.reason,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'BOOKING_CHECKIN': {
          operationResult = await storage.executeBookingCheckIn({
            bookingId: entityId || payload.bookingId,
            businessId,
            branchId,
            startSession: Boolean(payload.startSession),
            sessionId: payload.sessionId,
            hourlyRateMMK: Number(payload.hourlyRateMMK) || 0,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'BOOKING_NO_SHOW': {
          operationResult = await storage.executeBookingNoShow({
            bookingId: entityId || payload.bookingId,
            businessId,
            branchId,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'BOOKING_COMPLETE': {
          operationResult = await storage.executeBookingComplete({
            bookingId: entityId || payload.bookingId,
            businessId,
            branchId,
            sessionId: payload.sessionId,
            invoiceId: payload.invoiceId,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        // ==========================================
        // PHASE 27: MEMBERSHIPS, PACKAGES, GIFT CARDS, TIPS, MIXED PAYMENT
        // ==========================================

        case 'MEMBERSHIP_PLAN_CREATE': {
          if (user.role !== 'owner' && user.role !== 'manager') {
            return res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Only managers and owners can create membership plans' });
          }
          operationResult = await storage.executeMembershipPlanCreate({
            planId: entityId || payload.planId || `mplan_${Date.now()}`,
            businessId,
            branchId,
            name: payload.name,
            nameMm: payload.nameMm,
            durationDays: Number(payload.durationDays) || 30,
            priceMMK: Number(payload.priceMMK) || 0,
            discountPercent: Number(payload.discountPercent) || 0,
            benefitsSummary: payload.benefitsSummary,
            isActive: payload.isActive,
            userId: user.id,
          });
          break;
        }

        case 'MEMBERSHIP_PLAN_UPDATE': {
          if (user.role !== 'owner' && user.role !== 'manager') {
            return res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Only managers and owners can update membership plans' });
          }
          operationResult = await storage.executeMembershipPlanUpdate({
            planId: entityId || payload.planId,
            businessId,
            branchId,
            name: payload.name,
            nameMm: payload.nameMm,
            durationDays: payload.durationDays !== undefined ? Number(payload.durationDays) : undefined,
            priceMMK: payload.priceMMK !== undefined ? Number(payload.priceMMK) : undefined,
            discountPercent: payload.discountPercent !== undefined ? Number(payload.discountPercent) : undefined,
            benefitsSummary: payload.benefitsSummary,
            isActive: payload.isActive,
            userId: user.id,
          });
          break;
        }

        case 'MEMBERSHIP_PURCHASE': {
          operationResult = await storage.executeMembershipPurchase({
            membershipId: entityId || payload.membershipId || `cmem_${Date.now()}`,
            businessId,
            branchId,
            customerId: payload.customerId,
            customerName: payload.customerName,
            customerPhone: payload.customerPhone,
            planId: payload.planId,
            paymentMethod: payload.paymentMethod || 'cash',
            startDate: payload.startDate,
            invoiceId: payload.invoiceId,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'MEMBERSHIP_CANCEL': {
          if (user.role !== 'owner' && user.role !== 'manager') {
            return res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Only managers and owners can cancel memberships' });
          }
          operationResult = await storage.executeMembershipCancel({
            membershipId: entityId || payload.membershipId,
            businessId,
            branchId,
            reason: payload.reason,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'SERVICE_PACKAGE_CREATE': {
          if (user.role !== 'owner' && user.role !== 'manager') {
            return res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Only managers and owners can create service packages' });
          }
          operationResult = await storage.executeServicePackageCreate({
            packageId: entityId || payload.packageId || `spkg_${Date.now()}`,
            businessId,
            branchId,
            name: payload.name,
            nameMm: payload.nameMm,
            serviceId: payload.serviceId,
            serviceName: payload.serviceName,
            totalQty: Number(payload.totalQty) || 1,
            priceMMK: Number(payload.priceMMK) || 0,
            validityDays: Number(payload.validityDays) || 90,
            isActive: payload.isActive,
            userId: user.id,
          });
          break;
        }

        case 'SERVICE_PACKAGE_UPDATE': {
          if (user.role !== 'owner' && user.role !== 'manager') {
            return res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Only managers and owners can update service packages' });
          }
          operationResult = await storage.executeServicePackageUpdate({
            packageId: entityId || payload.packageId,
            businessId,
            branchId,
            name: payload.name,
            nameMm: payload.nameMm,
            totalQty: payload.totalQty !== undefined ? Number(payload.totalQty) : undefined,
            priceMMK: payload.priceMMK !== undefined ? Number(payload.priceMMK) : undefined,
            validityDays: payload.validityDays !== undefined ? Number(payload.validityDays) : undefined,
            isActive: payload.isActive,
            userId: user.id,
          });
          break;
        }

        case 'PACKAGE_PURCHASE': {
          operationResult = await storage.executePackagePurchase({
            customerPackageId: entityId || payload.customerPackageId || `cpkg_${Date.now()}`,
            businessId,
            branchId,
            customerId: payload.customerId,
            customerName: payload.customerName,
            customerPhone: payload.customerPhone,
            packageId: payload.packageId,
            paymentMethod: payload.paymentMethod || 'cash',
            invoiceId: payload.invoiceId,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'PACKAGE_REDEEM': {
          operationResult = await storage.executePackageRedeem({
            customerPackageId: entityId || payload.customerPackageId,
            quantity: Number(payload.quantity) || 1,
            businessId,
            branchId,
            sessionId: payload.sessionId,
            invoiceId: payload.invoiceId,
            notes: payload.notes,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'PACKAGE_CANCEL': {
          if (user.role !== 'owner' && user.role !== 'manager') {
            return res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Only managers and owners can cancel packages' });
          }
          operationResult = await storage.executePackageCancel({
            customerPackageId: entityId || payload.customerPackageId,
            businessId,
            branchId,
            reason: payload.reason,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'GIFT_CARD_ISSUE': {
          operationResult = await storage.executeGiftCardIssue({
            giftCardId: entityId || payload.giftCardId || `gc_${Date.now()}`,
            cardNumber: payload.cardNumber,
            businessId,
            branchId,
            initialAmountMMK: Number(payload.initialAmountMMK) || 0,
            customerId: payload.customerId,
            customerName: payload.customerName,
            expiryDays: payload.expiryDays ? Number(payload.expiryDays) : undefined,
            paymentMethod: payload.paymentMethod || 'cash',
            notes: payload.notes,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'GIFT_CARD_REDEEM': {
          operationResult = await storage.executeGiftCardRedeem({
            giftCardIdOrNumber: payload.giftCardIdOrNumber || payload.cardNumber || entityId,
            amountMMK: Number(payload.amountMMK) || 0,
            businessId,
            branchId,
            sessionId: payload.sessionId,
            invoiceId: payload.invoiceId,
            notes: payload.notes,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'GIFT_CARD_VOID': {
          if (user.role !== 'owner' && user.role !== 'manager') {
            return res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Only managers and owners can void gift cards' });
          }
          operationResult = await storage.executeGiftCardVoid({
            giftCardIdOrNumber: payload.giftCardIdOrNumber || payload.cardNumber || entityId,
            businessId,
            branchId,
            reason: payload.reason,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'TIP_RECORD': {
          operationResult = await storage.executeTipRecord({
            tipId: entityId || payload.tipId || `tip_${Date.now()}`,
            businessId,
            branchId,
            sessionId: payload.sessionId,
            invoiceId: payload.invoiceId,
            staffId: payload.staffId,
            staffName: payload.staffName,
            amountMMK: Number(payload.amountMMK) || 0,
            paymentMethod: payload.paymentMethod || 'cash',
            receivedBy: user.name,
            notes: payload.notes,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'MIXED_PAYMENT': {
          operationResult = await storage.executeMixedPayment({
            invoiceId: entityId || payload.invoiceId,
            businessId,
            branchId,
            payments: payload.payments || [],
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        // ==========================================
        // PHASE 28: CUSTOMER NOTES & PREFERENCES
        // ==========================================

        case 'CUSTOMER_NOTE_CREATE': {
          operationResult = await storage.executeCustomerNoteCreate({
            noteId: entityId || payload.noteId || `cnote_${Date.now()}`,
            businessId,
            branchId,
            customerId: payload.customerId,
            customerName: payload.customerName,
            sessionId: payload.sessionId,
            bookingId: payload.bookingId,
            serviceId: payload.serviceId,
            serviceName: payload.serviceName,
            staffId: payload.staffId,
            staffName: payload.staffName,
            category: payload.category || 'general',
            title: payload.title || 'Note',
            content: payload.content || '',
            tags: payload.tags,
            focusAreas: payload.focusAreas,
            isPrivate: Boolean(payload.isPrivate),
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'CUSTOMER_NOTE_UPDATE': {
          operationResult = await storage.executeCustomerNoteUpdate({
            noteId: entityId || payload.noteId,
            businessId,
            branchId,
            title: payload.title,
            content: payload.content,
            category: payload.category,
            tags: payload.tags,
            focusAreas: payload.focusAreas,
            isPrivate: payload.isPrivate,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'CUSTOMER_NOTE_DELETE': {
          operationResult = await storage.executeCustomerNoteDelete({
            noteId: entityId || payload.noteId,
            businessId,
            branchId,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'CUSTOMER_PREFERENCES_UPDATE': {
          operationResult = await storage.executeCustomerPreferencesUpdate({
            customerId: entityId || payload.customerId,
            businessId,
            branchId,
            preferences: payload.preferences,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        // ==========================================
        // PHASE 36: STAFF ATTENDANCE, SHIFTS, CONSUMABLES & PAYROLL
        // ==========================================

        case 'STAFF_CLOCK_IN': {
          operationResult = await storage.executeStaffClockIn({
            attendanceId: entityId || payload.attendanceId,
            businessId,
            branchId,
            staffId: payload.staffId,
            staffName: payload.staffName,
            date: payload.date,
            checkInTime: payload.checkInTime,
            status: payload.status,
            notes: payload.notes,
            deviceId: deviceId || callerDeviceId,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'STAFF_CLOCK_OUT': {
          operationResult = await storage.executeStaffClockOut({
            attendanceId: entityId || payload.attendanceId,
            businessId,
            branchId,
            checkOutTime: payload.checkOutTime,
            notes: payload.notes,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'SHIFT_OPEN': {
          operationResult = await storage.executeShiftOpen({
            shiftId: entityId || payload.shiftId,
            businessId,
            branchId,
            shiftCode: payload.shiftCode,
            staffId: payload.staffId || user.id,
            staffName: payload.staffName || user.name,
            openingFloatMMK: Number(payload.openingFloatMMK) || 0,
            notes: payload.notes,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'SHIFT_CLOSE': {
          operationResult = await storage.executeShiftClose({
            shiftId: entityId || payload.shiftId,
            businessId,
            branchId,
            actualCashMMK: Number(payload.actualCashMMK) || 0,
            notes: payload.notes,
            handedOverToId: payload.handedOverToId,
            handedOverToName: payload.handedOverToName,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'SERVICE_CONSUMABLE_LINK': {
          if (user.role !== 'owner' && user.role !== 'manager') {
            return res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Only managers and owners can configure service consumables' });
          }
          operationResult = await storage.executeServiceConsumableLink({
            id: entityId || payload.id,
            businessId,
            branchId,
            serviceId: payload.serviceId,
            serviceName: payload.serviceName,
            productId: payload.productId,
            productName: payload.productName,
            quantity: Number(payload.quantity) || 1,
            unit: payload.unit,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'SERVICE_CONSUMABLES_DEDUCT': {
          operationResult = await storage.executeServiceConsumablesDeduct({
            serviceId: entityId || payload.serviceId,
            businessId,
            branchId,
            multiplier: Number(payload.multiplier) || 1,
            sessionId: payload.sessionId,
            invoiceId: payload.invoiceId,
            customerId: payload.customerId,
            customerName: payload.customerName,
            staffId: payload.staffId,
            staffName: payload.staffName,
            userId: user.id,
            userName: user.name,
          });
          break;
        }

        case 'STAFF_SETTLEMENT_CREATE': {
          if (user.role !== 'owner' && user.role !== 'manager') {
            return res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Only managers and owners can create staff payroll settlements' });
          }
          operationResult = await storage.executeStaffSettlementCreate({
            settlementId: entityId || payload.settlementId,
            businessId,
            branchId,
            staffId: payload.staffId,
            staffName: payload.staffName,
            baseSalaryMMK: Number(payload.baseSalaryMMK) || 0,
            bonusMMK: Number(payload.bonusMMK) || 0,
            deductionsMMK: Number(payload.deductionsMMK) || 0,
            notes: payload.notes,
            payImmediately: Boolean(payload.payImmediately),
            userId: user.id,
            userName: user.name,
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
      if (err.code === 'ROOM_OCCUPIED_CONFLICT' || err.code === 'DATE_ALREADY_CLOSED' || err.code === 'RESOURCE_CONFLICT' || err.code === 'INVALID_STATE_TRANSITION') {
        return res.status(409).json({ error: err.code, message: err.message });
      }
      if (err.code === 'CREDIT_LIMIT_EXCEEDED') {
        return res.status(422).json({ error: err.code, message: err.message });
      }
      return res.status(500).json({ error: 'OPERATION_EXECUTION_ERROR', message: err.message });
    }
  });

  // ==========================================
  // 4B. BOOKINGS QUERY & CONFLICT CHECK
  // ==========================================
  router.get('/bookings', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const date = req.query.date as string | undefined;
    const branchId = (req.query.branchId as string) || user.branchId;

    const bookings = storage.getBookings(user.businessId, branchId, date);
    res.json({ success: true, count: bookings.length, bookings });
  });

  router.post('/bookings/check-conflict', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const { date, startTime, endTime, roomId, staffId, excludeBookingId } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'date, startTime, and endTime are required' });
    }

    const result = storage.checkBookingConflict({
      businessId: user.businessId,
      branchId: user.branchId,
      date,
      startTime,
      endTime,
      roomId,
      staffId,
      excludeBookingId,
    });

    res.json({ success: true, ...result });
  });

  // ==========================================
  // 4C. PHASE 27: MEMBERSHIPS, PACKAGES, GIFT CARDS & TIPS QUERY
  // ==========================================
  router.get('/memberships/plans', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const plans = storage.getMembershipPlans(user.businessId, user.branchId);
    res.json({ success: true, count: plans.length, plans });
  });

  router.get('/memberships/customer/:customerId', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const { customerId } = req.params;
    const memberships = storage.getCustomerMemberships(user.businessId, customerId);
    res.json({ success: true, count: memberships.length, memberships });
  });

  router.get('/packages', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const packages = storage.getServicePackages(user.businessId, user.branchId);
    res.json({ success: true, count: packages.length, packages });
  });

  router.get('/packages/customer/:customerId', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const { customerId } = req.params;
    const packages = storage.getCustomerPackages(user.businessId, customerId);
    res.json({ success: true, count: packages.length, packages });
  });

  router.get('/giftcards', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const giftCards = storage.getGiftCards(user.businessId, user.branchId);
    res.json({ success: true, count: giftCards.length, giftCards });
  });

  router.get('/giftcards/:cardNumber', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const { cardNumber } = req.params;
    const card = storage.getGiftCardByNumber(user.businessId, cardNumber);
    if (!card) {
      return res.status(404).json({ error: 'CARD_NOT_FOUND', message: `Gift card ${cardNumber} not found` });
    }
    res.json({ success: true, giftCard: card });
  });

  router.get('/tips', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const staffId = req.query.staffId as string | undefined;
    const date = req.query.date as string | undefined;
    const tips = storage.getTips(user.businessId, user.branchId, staffId, date);
    res.json({ success: true, count: tips.length, tips });
  });

  router.get('/customers/:customerId/profile', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const { customerId } = req.params;
    const canViewSensitive = ['owner', 'manager', 'admin'].includes(user.role);
    const profile = storage.getCustomerFinancialProfile(user.businessId, customerId, canViewSensitive);
    if (!profile) {
      return res.status(404).json({ error: 'CUSTOMER_NOT_FOUND', message: `Customer ${customerId} not found` });
    }
    res.json({ success: true, ...profile });
  });

  router.get('/customers/:customerId/notes', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const { customerId } = req.params;
    const canViewSensitive = ['owner', 'manager', 'admin'].includes(user.role);
    const notes = storage.getCustomerServiceNotes(user.businessId, customerId, canViewSensitive);
    res.json({ success: true, count: notes.length, notes });
  });

  router.post('/customers/:customerId/notes', requireAuth(), async (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const { customerId } = req.params;
    const {
      sessionId,
      bookingId,
      serviceId,
      serviceName,
      staffId,
      staffName,
      category,
      title,
      content,
      tags,
      focusAreas,
      isPrivate,
      customerName,
    } = req.body;

    if (!category || !title || !content) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'category, title, and content are required' });
    }

    const noteId = `cnote_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const result = await storage.executeCustomerNoteCreate({
      noteId,
      businessId: user.businessId,
      branchId: user.branchId,
      customerId,
      customerName,
      sessionId,
      bookingId,
      serviceId,
      serviceName,
      staffId,
      staffName,
      category,
      title,
      content,
      tags,
      focusAreas,
      isPrivate: Boolean(isPrivate),
      userId: user.id,
      userName: user.name,
    });

    res.json({ success: true, noteId, ...result });
  });

  router.put('/customers/notes/:noteId', requireAuth(), async (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const { noteId } = req.params;
    const { title, content, category, tags, focusAreas, isPrivate } = req.body;

    const result = await storage.executeCustomerNoteUpdate({
      noteId,
      businessId: user.businessId,
      branchId: user.branchId,
      title,
      content,
      category,
      tags,
      focusAreas,
      isPrivate,
      userId: user.id,
      userName: user.name,
    });

    res.json({ success: true, ...result });
  });

  router.delete('/customers/notes/:noteId', requireAuth(), async (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const { noteId } = req.params;

    const result = await storage.executeCustomerNoteDelete({
      noteId,
      businessId: user.businessId,
      branchId: user.branchId,
      userId: user.id,
      userName: user.name,
    });

    res.json({ success: true, ...result });
  });

  router.put('/customers/:customerId/preferences', requireAuth(), async (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const { customerId } = req.params;
    const { preferences } = req.body;

    const result = await storage.executeCustomerPreferencesUpdate({
      customerId,
      businessId: user.businessId,
      branchId: user.branchId,
      preferences,
      userId: user.id,
      userName: user.name,
    });

    res.json({ success: true, ...result });
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
  // PHASE 36 QUERY ENDPOINTS
  // ==========================================

  router.get('/staff-attendance', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const branchId = (req.query.branchId as string) || user.branchId;
    const date = req.query.date as string | undefined;
    const staffId = req.query.staffId as string | undefined;
    const attendance = storage.getStaffAttendance(user.businessId, branchId, date, staffId);
    res.json({ success: true, count: attendance.length, attendance });
  });

  router.get('/shift-handovers', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const branchId = (req.query.branchId as string) || user.branchId;
    const status = req.query.status as string | undefined;
    const shifts = storage.getShiftHandovers(user.businessId, branchId, status);
    res.json({ success: true, count: shifts.length, shifts });
  });

  router.get('/service-consumables', requireAuth(), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const serviceId = req.query.serviceId as string | undefined;
    const consumables = storage.getServiceConsumables(user.businessId, serviceId);
    res.json({ success: true, count: consumables.length, consumables });
  });

  router.get('/stock-movements', requireAuth(['owner', 'manager']), (req: Request, res: Response) => {
    const user = (req as any).user as ServerUserEntity;
    const branchId = (req.query.branchId as string) || (user.role === 'owner' ? undefined : user.branchId);
    const productId = req.query.productId as string | undefined;
    const movements = storage.getStockMovements(user.businessId, branchId, productId);
    res.json({ success: true, count: movements.length, movements });
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

  // ==========================================
  // PHASE 35: SUPPLIERS & PURCHASING ROUTES
  // ==========================================
  router.get('/suppliers', requireAuth(), (req: Request, res: Response) => {
    try {
      const suppliers = storage.getSuppliers();
      res.json({ success: true, suppliers });
    } catch (err: any) {
      res.status(500).json({ error: 'SUPPLIERS_FETCH_FAILED', message: err.message });
    }
  });

  router.post('/suppliers', requireAuth(['owner', 'manager']), (req: Request, res: Response) => {
    try {
      const supplier = storage.saveSupplier(req.body);
      res.json({ success: true, supplier });
    } catch (err: any) {
      res.status(500).json({ error: 'SUPPLIER_SAVE_FAILED', message: err.message });
    }
  });

  router.get('/purchase-orders', requireAuth(), (req: Request, res: Response) => {
    try {
      const purchaseOrders = storage.getPurchaseOrders();
      res.json({ success: true, purchaseOrders });
    } catch (err: any) {
      res.status(500).json({ error: 'PO_FETCH_FAILED', message: err.message });
    }
  });

  router.post('/purchase-orders', requireAuth(['owner', 'manager']), async (req: Request, res: Response) => {
    try {
      const po = await storage.recordPurchaseOrder(req.body);
      res.json({ success: true, purchaseOrder: po });
    } catch (err: any) {
      res.status(500).json({ error: 'PO_CREATE_FAILED', message: err.message });
    }
  });

  router.get('/stock-adjustments', requireAuth(), (req: Request, res: Response) => {
    try {
      const adjustments = storage.getStockAdjustments();
      res.json({ success: true, adjustments });
    } catch (err: any) {
      res.status(500).json({ error: 'STOCK_ADJUSTMENT_FETCH_FAILED', message: err.message });
    }
  });

  router.post('/stock-adjustments', requireAuth(['owner', 'manager']), async (req: Request, res: Response) => {
    try {
      const adj = await storage.recordStockAdjustment(req.body);
      res.json({ success: true, adjustment: adj });
    } catch (err: any) {
      res.status(500).json({ error: 'STOCK_ADJUSTMENT_FAILED', message: err.message });
    }
  });

  router.get('/customers/:customerId/loyalty', requireAuth(), (req: Request, res: Response) => {
    try {
      const entries = storage.getCustomerLoyaltyEntries(req.params.customerId);
      res.json({ success: true, entries });
    } catch (err: any) {
      res.status(500).json({ error: 'LOYALTY_FETCH_FAILED', message: err.message });
    }
  });

  router.post('/customers/:customerId/loyalty', requireAuth(['owner', 'manager']), async (req: Request, res: Response) => {
    try {
      const entry = await storage.recordLoyaltyPoints({ customerId: req.params.customerId, ...req.body });
      res.json({ success: true, entry });
    } catch (err: any) {
      res.status(500).json({ error: 'LOYALTY_RECORD_FAILED', message: err.message });
    }
  });

  router.get('/performance-bonus-rules', requireAuth(), (req: Request, res: Response) => {
    try {
      const rules = storage.getPerformanceBonusRules();
      res.json({ success: true, rules });
    } catch (err: any) {
      res.status(500).json({ error: 'PERFORMANCE_RULES_FETCH_FAILED', message: err.message });
    }
  });

  router.post('/performance-bonus-rules', requireAuth(['owner', 'manager']), (req: Request, res: Response) => {
    try {
      const rule = storage.savePerformanceBonusRule(req.body);
      res.json({ success: true, rule });
    } catch (err: any) {
      res.status(500).json({ error: 'PERFORMANCE_RULE_SAVE_FAILED', message: err.message });
    }
  });

  return router;
}
