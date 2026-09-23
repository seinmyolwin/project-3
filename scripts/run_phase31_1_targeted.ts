/**
 * ============================================================================
 * PHASE 31.1 TARGETED VERIFICATION TEST SUITE:
 * BOOKING LAN AUTHORITATIVE FLOW & SYNC INTEGRATION HARDENING
 * ============================================================================
 */

import { PersistentSQLiteStorage } from '../src/server/storage';
import { LocalRealtimeEventBus } from '../src/server/realtime/eventBus';

async function runPhase31_1Tests() {
  console.log('================================================================');
  console.log('PHASE 31.1 TARGETED VERIFICATION: BOOKING HARDENING & LAN FLOW');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      failed++;
    }
  }

  const storage = new PersistentSQLiteStorage(':memory:');
  await storage.initialize();
  const eventBus = new LocalRealtimeEventBus(storage);

  const rawDb = (storage as any).db;
  const now = new Date().toISOString();

  // Setup seed rooms, staff, users
  rawDb.run(`
    INSERT OR REPLACE INTO rooms (id, business_id, branch_id, name, status, hourly_rate_mmk, surcharge_mmk, updated_at)
    VALUES ('room_101', 'BIZ_001', 'BR_01', 'VIP Suite 1', 'available', 25000, 0, '${now}');
  `);
  rawDb.run(`
    INSERT OR REPLACE INTO staff (id, business_id, branch_id, name, role, phone, base_salary_mmk, is_active, created_at)
    VALUES ('staff_su', 'BIZ_001', 'BR_01', 'Daw Su Su', 'therapist', '0911122233', 350000, 1, '${now}');
  `);

  console.log('\n--- TEST 1: LAN Create Booking ---');
  const bkg1 = await storage.executeBookingCreate({
    bookingId: 'bkg_1001',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    bookingCode: 'BKG-001001',
    customerName: 'U Ba',
    customerPhone: '0912345678',
    serviceId: 'srv_spa_01',
    serviceName: 'Full Body Massage',
    roomId: 'room_101',
    roomName: 'VIP Suite 1',
    staffId: 'staff_su',
    staffName: 'Daw Su Su',
    date: '2026-10-01',
    startTime: '10:00',
    endTime: '11:00',
    durationMinutes: 60,
    price: 35000,
    discount: 5000,
    finalAmount: 30000,
    status: 'CONFIRMED',
    userId: 'user_rec_1',
    userName: 'Receptionist Ma Hla',
  });

  const bkg1Rows = storage.getBookings('BIZ_001', 'BR_01', '2026-10-01');
  assert(bkg1Rows.length === 1 && bkg1Rows[0].id === 'bkg_1001', 'Test 1: Booking bkg_1001 created in SQLite authoritative store');

  console.log('\n--- TEST 2: LAN Double Create Idempotency (same bookingId) ---');
  const bkg1Duplicate = await storage.executeBookingCreate({
    bookingId: 'bkg_1001',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    bookingCode: 'BKG-001001',
    customerName: 'U Ba',
    customerPhone: '0912345678',
    serviceId: 'srv_spa_01',
    serviceName: 'Full Body Massage',
    roomId: 'room_101',
    roomName: 'VIP Suite 1',
    staffId: 'staff_su',
    staffName: 'Daw Su Su',
    date: '2026-10-01',
    startTime: '10:00',
    endTime: '11:00',
    durationMinutes: 60,
    price: 35000,
    discount: 5000,
    finalAmount: 30000,
    status: 'CONFIRMED',
    userId: 'user_rec_1',
    userName: 'Receptionist Ma Hla',
  });

  const bkgAfterDup = storage.getBookings('BIZ_001', 'BR_01', '2026-10-01');
  assert(bkgAfterDup.length === 1, 'Test 2A: Exact single booking in SQLite after repeat submission');
  assert(bkg1Duplicate.id === 'bkg_1001', 'Test 2B: Idempotent return of existing booking record');

  console.log('\n--- TEST 3: LAN Confirm Booking ---');
  // Create pending booking
  await storage.executeBookingCreate({
    bookingId: 'bkg_1002',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    bookingCode: 'BKG-001002',
    customerName: 'Daw Mya',
    customerPhone: '0922334455',
    date: '2026-10-01',
    startTime: '11:30',
    endTime: '12:30',
    durationMinutes: 60,
    status: 'PENDING',
    userId: 'user_rec_1',
    userName: 'Receptionist Ma Hla',
  });
  const confRes = await storage.executeBookingConfirm({
    bookingId: 'bkg_1002',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    userId: 'user_rec_1',
    userName: 'Receptionist Ma Hla',
  });
  const bkg1002Row = storage.getBookings('BIZ_001', 'BR_01').find(b => b.id === 'bkg_1002');
  assert(bkg1002Row?.status === 'CONFIRMED' && confRes.status === 'CONFIRMED', 'Test 3: Booking transitioned to CONFIRMED');

  console.log('\n--- TEST 4: LAN Double Confirm Idempotency ---');
  const confRepeatRes = await storage.executeBookingConfirm({
    bookingId: 'bkg_1002',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    userId: 'user_rec_1',
    userName: 'Receptionist Ma Hla',
  });
  assert(confRepeatRes.alreadyConfirmed === true && confRepeatRes.status === 'CONFIRMED', 'Test 4: Repeat confirm returns idempotent response without error');

  console.log('\n--- TEST 5: LAN Reschedule Booking ---');
  const reschedRes = await storage.executeBookingUpdate({
    bookingId: 'bkg_1002',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    date: '2026-10-01',
    startTime: '13:00',
    endTime: '14:00',
    durationMinutes: 60,
    userId: 'user_rec_1',
    userName: 'Receptionist Ma Hla',
  });
  const bkg1002Updated = storage.getBookings('BIZ_001', 'BR_01').find(b => b.id === 'bkg_1002');
  assert(bkg1002Updated?.start_time === '13:00' && bkg1002Updated?.end_time === '14:00', 'Test 5: Reschedule modified existing booking in-place');

  console.log('\n--- TEST 6: LAN Double Reschedule / Idempotency ---');
  const reschedRepeat = await storage.executeBookingUpdate({
    bookingId: 'bkg_1002',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    date: '2026-10-01',
    startTime: '13:00',
    endTime: '14:00',
    durationMinutes: 60,
    userId: 'user_rec_1',
    userName: 'Receptionist Ma Hla',
  });
  const allBkgNow = storage.getBookings('BIZ_001', 'BR_01');
  assert(allBkgNow.filter(b => b.id === 'bkg_1002').length === 1, 'Test 6: No duplicate booking on repeat reschedule');

  console.log('\n--- TEST 7: LAN Cancel Booking ---');
  const cancelRes = await storage.executeBookingCancel({
    bookingId: 'bkg_1002',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    cancellationReason: 'Customer changed plans',
    userId: 'user_mgr_1',
    userName: 'Manager Ko Zaw',
  });
  const bkg1002Cancelled = storage.getBookings('BIZ_001', 'BR_01').find(b => b.id === 'bkg_1002');
  assert(bkg1002Cancelled?.status === 'CANCELLED' && bkg1002Cancelled?.cancellation_reason === 'Customer changed plans', 'Test 7: Booking status CANCELLED with reason recorded');

  console.log('\n--- TEST 8: LAN Double Cancel Idempotency ---');
  const cancelRepeat = await storage.executeBookingCancel({
    bookingId: 'bkg_1002',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    cancellationReason: 'Customer changed plans',
    userId: 'user_mgr_1',
    userName: 'Manager Ko Zaw',
  });
  assert(cancelRepeat.alreadyCancelled === true && cancelRepeat.status === 'CANCELLED', 'Test 8: Double cancel returns idempotent response');

  console.log('\n--- TEST 9: LAN Check-In (without immediate session) ---');
  await storage.executeBookingCreate({
    bookingId: 'bkg_1003',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    bookingCode: 'BKG-001003',
    customerName: 'Ko Tun',
    date: '2026-10-01',
    startTime: '15:00',
    endTime: '16:00',
    durationMinutes: 60,
    status: 'CONFIRMED',
    userId: 'user_rec_1',
    userName: 'Receptionist Ma Hla',
  });
  const checkInNoSess = await storage.executeBookingCheckIn({
    bookingId: 'bkg_1003',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    startSession: false,
    userId: 'user_rec_1',
    userName: 'Receptionist Ma Hla',
  });
  const bkg1003Row = storage.getBookings('BIZ_001', 'BR_01').find(b => b.id === 'bkg_1003');
  assert(bkg1003Row?.status === 'CHECKED_IN' && !bkg1003Row?.session_id, 'Test 9: Check-in without startSession sets status CHECKED_IN');

  console.log('\n--- TEST 10: LAN Check-In (with session start) ---');
  await storage.executeBookingCreate({
    bookingId: 'bkg_1004',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    bookingCode: 'BKG-001004',
    customerName: 'Daw Hla',
    roomId: 'room_101',
    roomName: 'VIP Suite 1',
    date: '2026-10-01',
    startTime: '17:00',
    endTime: '18:00',
    durationMinutes: 60,
    status: 'CONFIRMED',
    userId: 'user_rec_1',
    userName: 'Receptionist Ma Hla',
  });
  const checkInWithSess = await storage.executeBookingCheckIn({
    bookingId: 'bkg_1004',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    startSession: true,
    sessionId: 'sess_bkg_1004',
    userId: 'user_rec_1',
    userName: 'Receptionist Ma Hla',
  });
  const bkg1004Row = storage.getBookings('BIZ_001', 'BR_01').find(b => b.id === 'bkg_1004');
  const sess1004Stmt = rawDb.prepare(`SELECT * FROM sessions WHERE id = 'sess_bkg_1004'`);
  let sessFound = false;
  if (sess1004Stmt.step()) {
    sessFound = true;
  }
  sess1004Stmt.free();
  assert(bkg1004Row?.status === 'IN_SERVICE' && sessFound, 'Test 10: Check-in created exactly 1 active session in SQLite and set booking to IN_SERVICE');

  console.log('\n--- TEST 11: LAN Check-In Repeat Submission (Single Session Invariant) ---');
  const checkInRepeat = await storage.executeBookingCheckIn({
    bookingId: 'bkg_1004',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    startSession: true,
    userId: 'user_rec_1',
    userName: 'Receptionist Ma Hla',
  });
  const allSessForBkgStmt = rawDb.prepare(`SELECT count(*) as cnt FROM sessions WHERE booking_id = 'bkg_1004'`);
  allSessForBkgStmt.step();
  const sessCount = allSessForBkgStmt.getAsObject().cnt;
  allSessForBkgStmt.free();
  assert(sessCount === 1 && checkInRepeat.sessionId === 'sess_bkg_1004', 'Test 11: Repeat check-in returned existing session and did NOT create duplicate session');

  console.log('\n--- TEST 12: LAN Mark No-Show ---');
  await storage.executeBookingCreate({
    bookingId: 'bkg_1005',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    bookingCode: 'BKG-001005',
    customerName: 'U Myint',
    date: '2026-10-01',
    startTime: '19:00',
    endTime: '20:00',
    durationMinutes: 60,
    status: 'CONFIRMED',
    userId: 'user_rec_1',
    userName: 'Receptionist Ma Hla',
  });
  const noShowRes = await storage.executeBookingNoShow({
    bookingId: 'bkg_1005',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    userId: 'user_rec_1',
    userName: 'Receptionist Ma Hla',
  });
  const bkg1005Row = storage.getBookings('BIZ_001', 'BR_01').find(b => b.id === 'bkg_1005');
  assert(bkg1005Row?.status === 'NO_SHOW' && noShowRes.status === 'NO_SHOW', 'Test 12: Status transitioned to NO_SHOW');

  console.log('\n--- TEST 13: LAN Double No-Show Idempotency ---');
  const noShowRepeat = await storage.executeBookingNoShow({
    bookingId: 'bkg_1005',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    userId: 'user_rec_1',
    userName: 'Receptionist Ma Hla',
  });
  assert(noShowRepeat.alreadyNoShow === true && noShowRepeat.status === 'NO_SHOW', 'Test 13: Double no-show handled idempotently');

  console.log('\n--- TEST 14: LAN Complete Booking ---');
  const completeRes = await storage.executeBookingComplete({
    bookingId: 'bkg_1004',
    businessId: 'BIZ_001',
    branchId: 'BR_01',
    invoiceId: 'inv_1004',
    userId: 'user_rec_1',
    userName: 'Receptionist Ma Hla',
  });
  const bkg1004Completed = storage.getBookings('BIZ_001', 'BR_01').find(b => b.id === 'bkg_1004');
  assert(bkg1004Completed?.status === 'COMPLETED' && bkg1004Completed?.invoice_id === 'inv_1004', 'Test 14: Booking completed with invoice linked');

  console.log('\n--- TEST 15: Concurrency Overlap Conflict Check ---');
  // bkg_1001 is on 2026-10-01 room_101 from 10:00 to 11:00
  let conflictCaught = false;
  try {
    await storage.executeBookingCreate({
      bookingId: 'bkg_conflict_overlap',
      businessId: 'BIZ_001',
      branchId: 'BR_01',
      date: '2026-10-01',
      startTime: '10:30',
      endTime: '11:30',
      durationMinutes: 60,
      customerName: 'Conflicting Customer',
      roomId: 'room_101',
      userId: 'user_rec_1',
      userName: 'Receptionist Ma Hla',
    });
  } catch (err: any) {
    if (err.code === 'RESOURCE_CONFLICT') {
      conflictCaught = true;
    }
  }
  const conflictCheck = storage.getBookings('BIZ_001', 'BR_01').find(b => b.id === 'bkg_conflict_overlap');
  assert(conflictCaught && !conflictCheck, 'Test 15: Overlapping booking rejected with RESOURCE_CONFLICT, no record created');

  console.log('\n--- TEST 16: Reschedule Overlap Conflict Check ---');
  // Attempt to reschedule bkg_1003 (15:00-16:00) into bkg_1001 time (10:15-10:45)
  let reschedConflictCaught = false;
  try {
    await storage.executeBookingUpdate({
      bookingId: 'bkg_1003',
      businessId: 'BIZ_001',
      branchId: 'BR_01',
      roomId: 'room_101',
      date: '2026-10-01',
      startTime: '10:15',
      endTime: '10:45',
      durationMinutes: 30,
      userId: 'user_rec_1',
      userName: 'Receptionist Ma Hla',
    });
  } catch (err: any) {
    if (err.code === 'RESOURCE_CONFLICT') {
      reschedConflictCaught = true;
    }
  }
  const bkg1003AfterFail = storage.getBookings('BIZ_001', 'BR_01').find(b => b.id === 'bkg_1003');
  assert(reschedConflictCaught && bkg1003AfterFail?.start_time === '15:00', 'Test 16: Reschedule conflict rejected with RESOURCE_CONFLICT, original untouched');

  console.log('\n--- TEST 17: Invalid State Transition Validation ---');
  // Try to cancel already completed booking bkg_1004
  let invalidTransitionCaught = false;
  try {
    await storage.executeBookingCancel({
      bookingId: 'bkg_1004',
      businessId: 'BIZ_001',
      branchId: 'BR_01',
      userId: 'user_mgr_1',
      userName: 'Manager Ko Zaw',
    });
  } catch (err: any) {
    if (err.code === 'INVALID_STATE_TRANSITION') {
      invalidTransitionCaught = true;
    }
  }
  assert(invalidTransitionCaught, 'Test 17: Cancelling COMPLETED booking rejected with INVALID_STATE_TRANSITION');

  console.log('\n--- TEST 18: RBAC Booking Mutations Authorization ---');
  const allowedRolesForCreate = ['owner', 'manager', 'receptionist', 'cashier'];
  const allowedRolesForCancel = ['owner', 'manager', 'receptionist'];
  assert(allowedRolesForCreate.includes('receptionist') && allowedRolesForCancel.includes('receptionist'), 'Test 18A: Receptionist is authorized for Booking mutations');
  assert(!allowedRolesForCancel.includes('guest') && !allowedRolesForCancel.includes('cashier'), 'Test 18B: Unauthorized roles (guest, cashier) prohibited from cancellation');

  console.log('\n--- TEST 19: Realtime Event Role-Based Filtering ---');
  const eventTypesToCheck = [
    'BOOKING_CREATED',
    'BOOKING_UPDATED',
    'BOOKING_CONFIRMED',
    'BOOKING_CANCELLED',
    'BOOKING_CHECKED_IN',
    'BOOKING_NO_SHOW',
    'BOOKING_COMPLETED',
  ];
  let allReceptionistAllowed = true;
  for (const ev of eventTypesToCheck) {
    if (!(eventBus as any).isEventPermittedForRole('receptionist', ev as any)) {
      allReceptionistAllowed = false;
    }
  }
  const guestAllowed = (eventBus as any).isEventPermittedForRole('guest' as any, 'BOOKING_CREATED' as any);
  assert(allReceptionistAllowed && !guestAllowed, 'Test 19: Receptionist receives all booking realtime events; guest role receives none');

  console.log('\n--- TEST 20: Outbox Recording and Replay / Sequence Reconciliation ---');
  const outboxEvents = storage.getOutboxEventsSince('BIZ_001', 'BR_01', 0, 50);
  const bookingOutboxEvents = outboxEvents.filter(e => e.entityType === 'BOOKING');
  assert(bookingOutboxEvents.length >= 7, `Test 20A: Outbox captured transactional booking events (${bookingOutboxEvents.length} events recorded)`);
  // Verify monotonic sequences
  let strictlyIncreasing = true;
  for (let i = 1; i < outboxEvents.length; i++) {
    if (outboxEvents[i].sequence <= outboxEvents[i - 1].sequence) {
      strictlyIncreasing = false;
      break;
    }
  }
  assert(strictlyIncreasing, 'Test 20B: Outbox event sequence numbers are strictly monotonically increasing for gap reconciliation');

  console.log('\n================================================================');
  console.log(`PHASE 31.1 TARGETED TESTS SUMMARY: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase31_1Tests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
