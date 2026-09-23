/**
 * ============================================================================
 * PHASE 25 TARGETED TEST SUITE: BOOKINGS, APPOINTMENTS & RESOURCE CONFLICTS
 * ============================================================================
 */

import { PersistentSQLiteStorage } from '../src/server/storage';
import { LocalRealtimeEventBus } from '../src/server/realtime/eventBus';

async function runPhase25Tests() {
  console.log('==================================================');
  console.log('PHASE 25 TARGETED VERIFICATION TEST SUITE');
  console.log('==================================================');

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

  // Setup seed rooms and staff
  rawDb.run(`
    INSERT OR REPLACE INTO rooms (id, business_id, branch_id, name, status, hourly_rate_mmk, surcharge_mmk, updated_at)
    VALUES ('room_vip_1', 'BIZ_SHOP_001', 'BR_MAIN', 'VIP Suite 1', 'available', 20000, 0, '${now}');
  `);
  rawDb.run(`
    INSERT OR REPLACE INTO staff (id, business_id, branch_id, name, role, phone, base_salary_mmk, is_active, created_at)
    VALUES ('staff_aye', 'BIZ_SHOP_001', 'BR_MAIN', 'Daw Aye Aye', 'therapist', '0922233344', 300000, 1, '${now}');
  `);

  console.log('\n--- TEST GROUP 1: Booking Creation & Realtime Outbox ---');
  let booking1: any;
  try {
    booking1 = await storage.executeBookingCreate({
      bookingId: 'bkg_001',
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      bookingCode: 'BKG-2026-001',
      customerName: 'Daw Khin Khin',
      customerPhone: '09788889999',
      serviceId: 'srv_massage',
      serviceName: 'Aromatherapy Oil Massage',
      roomId: 'room_vip_1',
      roomName: 'VIP Suite 1',
      staffId: 'staff_aye',
      staffName: 'Daw Aye Aye',
      date: '2026-09-23',
      startTime: '14:00',
      endTime: '15:30',
      durationMinutes: 90,
      notes: 'Prefers mild pressure',
      depositAmountMMK: 10000,
      depositPaymentMethod: 'kpay',
      userId: 'user_reception',
      userName: 'Receptionist Su',
    });

    assert(booking1 && booking1.id === 'bkg_001', 'Booking created successfully with ID bkg_001');
    assert(booking1.status === 'CONFIRMED', 'Booking initial status is CONFIRMED');
    assert(booking1.depositAmountMMK === 10000, 'Deposit amount MMK recorded correctly');
  } catch (err: any) {
    assert(false, `Booking create threw error: ${err.message}`);
  }

  console.log('\n--- TEST GROUP 2: Double-Booking Conflict Prevention ---');
  // 1. Overlapping Room conflict (14:30 - 16:00 overlaps 14:00 - 15:30)
  try {
    await storage.executeBookingCreate({
      bookingId: 'bkg_conflict_room',
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      customerName: 'U Aung San',
      customerPhone: '0911122233',
      roomId: 'room_vip_1',
      roomName: 'VIP Suite 1',
      date: '2026-09-23',
      startTime: '14:30',
      endTime: '16:00',
      durationMinutes: 90,
      userId: 'user_reception',
      userName: 'Receptionist Su',
    });
    assert(false, 'Should have rejected overlapping room booking');
  } catch (err: any) {
    assert(err.code === 'RESOURCE_CONFLICT', 'Overlapping room booking rejected with RESOURCE_CONFLICT');
  }

  // 2. Overlapping Staff conflict (15:00 - 16:00 overlaps 14:00 - 15:30)
  try {
    await storage.executeBookingCreate({
      bookingId: 'bkg_conflict_staff',
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      customerName: 'Daw Tin Tin',
      customerPhone: '0944455566',
      staffId: 'staff_aye',
      staffName: 'Daw Aye Aye',
      date: '2026-09-23',
      startTime: '15:00',
      endTime: '16:00',
      durationMinutes: 60,
      userId: 'user_reception',
      userName: 'Receptionist Su',
    });
    assert(false, 'Should have rejected overlapping staff booking');
  } catch (err: any) {
    assert(err.code === 'RESOURCE_CONFLICT', 'Overlapping staff booking rejected with RESOURCE_CONFLICT');
  }

  // 3. Non-overlapping booking for same room & staff (16:00 - 17:30 after 15:30)
  let booking2: any;
  try {
    booking2 = await storage.executeBookingCreate({
      bookingId: 'bkg_002',
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      customerName: 'U Than Htike',
      roomId: 'room_vip_1',
      roomName: 'VIP Suite 1',
      staffId: 'staff_aye',
      staffName: 'Daw Aye Aye',
      date: '2026-09-23',
      startTime: '16:00',
      endTime: '17:30',
      durationMinutes: 90,
      userId: 'user_reception',
      userName: 'Receptionist Su',
    });
    assert(booking2 && booking2.id === 'bkg_002', 'Non-overlapping subsequent booking permitted');
  } catch (err: any) {
    assert(false, `Non-overlapping booking failed unexpectedly: ${err.message}`);
  }

  console.log('\n--- TEST GROUP 3: Booking Modification & Re-check ---');
  try {
    const updated = await storage.executeBookingUpdate({
      bookingId: 'bkg_002',
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      customerName: 'U Than Htike (VIP)',
      date: '2026-09-23',
      startTime: '16:30',
      endTime: '18:00',
      durationMinutes: 90,
      notes: 'Wants extra towels',
      userId: 'user_reception',
      userName: 'Receptionist Su',
    });
    assert(updated.customer_name === 'U Than Htike (VIP)', 'Booking updated customer name');
    assert(updated.start_time === '16:30', 'Booking updated start time');
  } catch (err: any) {
    assert(false, `Booking update failed: ${err.message}`);
  }

  console.log('\n--- TEST GROUP 4: Booking Check-in & Session Transition ---');
  try {
    const checkInResult = await storage.executeBookingCheckIn({
      bookingId: 'bkg_001',
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      startSession: true,
      sessionId: 'sess_bkg_001',
      userId: 'user_reception',
      userName: 'Receptionist Su',
    });

    assert(checkInResult.status === 'IN_SERVICE', 'Booking transitioned to IN_SERVICE');
    assert(checkInResult.sessionId === 'sess_bkg_001', 'Booking linked to created session');

    // Verify room status in database
    const roomStmt = rawDb.prepare(`SELECT * FROM rooms WHERE id = 'room_vip_1'`);
    roomStmt.step();
    const roomObj = roomStmt.getAsObject();
    roomStmt.free();

    assert(roomObj.status === 'occupied', 'Room status updated to occupied');
    assert(roomObj.active_session_id === 'sess_bkg_001', 'Room active_session_id points to session');
  } catch (err: any) {
    assert(false, `Check-in threw error: ${err.message}`);
  }

  console.log('\n--- TEST GROUP 5: Booking Cancellation & Audit History ---');
  try {
    const cancelResult = await storage.executeBookingCancel({
      bookingId: 'bkg_002',
      businessId: 'BIZ_SHOP_001',
      branchId: 'BR_MAIN',
      cancellationReason: 'Customer requested rescheduling',
      userId: 'user_reception',
      userName: 'Receptionist Su',
    });

    assert(cancelResult.status === 'CANCELLED', 'Booking marked as CANCELLED');

    // Verify booking is still present in history with reason
    const bkgStmt = rawDb.prepare(`SELECT * FROM bookings WHERE id = 'bkg_002'`);
    bkgStmt.step();
    const bkgObj = bkgStmt.getAsObject();
    bkgStmt.free();

    assert(bkgObj.status === 'CANCELLED', 'Booking status preserved in database');
    assert(bkgObj.cancellation_reason === 'Customer requested rescheduling', 'Cancellation reason preserved');
    assert(bkgObj.cancelled_by === 'Receptionist Su', 'Cancelled by user recorded');
  } catch (err: any) {
    assert(false, `Cancellation failed: ${err.message}`);
  }

  console.log('\n--- TEST GROUP 6: Outbox Realtime Events Ordering ---');
  const events = storage.getOutboxEventsSince('BIZ_SHOP_001', 'BR_MAIN', 0);
  assert(events.length >= 6, `Outbox recorded ${events.length} events for booking operations`);

  const eventTypes = events.map((e) => e.eventType);
  assert(eventTypes.includes('BOOKING_CREATED'), 'Outbox contains BOOKING_CREATED event');
  assert(eventTypes.includes('BOOKING_UPDATED'), 'Outbox contains BOOKING_UPDATED event');
  assert(eventTypes.includes('BOOKING_CHECKED_IN'), 'Outbox contains BOOKING_CHECKED_IN event');
  assert(eventTypes.includes('BOOKING_CANCELLED'), 'Outbox contains BOOKING_CANCELLED event');

  let seqMonotonic = true;
  for (let i = 1; i < events.length; i++) {
    if (events[i].sequence <= events[i - 1].sequence) {
      seqMonotonic = false;
      break;
    }
  }
  assert(seqMonotonic, 'All booking events adhere strictly to monotonic sequence numbers');

  console.log('==================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('==================================================');

  storage.close();

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase25Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
