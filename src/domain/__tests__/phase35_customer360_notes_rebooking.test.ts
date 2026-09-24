import { PersistentSQLiteStorage } from '../../server/storage';

async function runPhase35Tests() {
  console.log('======================================================');
  console.log('PHASE 35 — CUSTOMER 360, SERVICE NOTES & REBOOKING TESTS');
  console.log('======================================================');

  const storage = new PersistentSQLiteStorage(':memory:');
  await storage.initialize();

  let testPassed = 0;
  let testFailed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(`FAIL: ${msg}`);
  }

  async function runTest(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(` ✓ [PASS] ${name}`);
      testPassed++;
    } catch (err: any) {
      console.error(` ❌ [FAIL] ${name}:`, err.message);
      testFailed++;
    }
  }

  const businessId = 'BIZ_TEST_35';
  const branchId = 'BR_TEST_35';
  const customerId = 'cust_35_daw_hla';
  const userId = 'usr_test_mgr';
  const userName = 'ဒေါ်မြ (Manager)';

  // Seed business and branch
  (storage as any).db.run(`
    INSERT INTO businesses (id, name, owner_name, phone, created_at, updated_at)
    VALUES (?, 'Shwe Thiri Wellness Lounge', 'Daw Hla Hla', '095000001', datetime('now'), datetime('now'))
  `, [businessId]);

  (storage as any).db.run(`
    INSERT INTO branches (id, business_id, name, code, is_active, created_at)
    VALUES (?, ?, 'Flagship Lounge', 'MAIN', 1, datetime('now'))
  `, [branchId, businessId]);

  // Seed customer
  (storage as any).db.run(`
    INSERT INTO customers (id, business_id, branch_id, name, phone, credit_limit_mmk, outstanding_balance_mmk, is_active, created_at)
    VALUES (?, ?, ?, 'Daw Hla', '09987654321', 200000, 15000, 1, datetime('now'))
  `, [customerId, businessId, branchId]);

  // Seed past invoices, sessions, bookings, packages, memberships, gift cards
  (storage as any).db.run(`
    INSERT INTO invoices (
      id, business_id, branch_id, invoice_number, customer_id, customer_name, subtotal_mmk, discount_mmk,
      total_mmk, paid_mmk, payment_method, payment_status, date, created_at
    ) VALUES
      ('inv_35_1', ?, ?, 'INV-3501', ?, 'Daw Hla', 50000, 0, 50000, 50000, 'cash', 'paid', '2026-09-01', '2026-09-01T10:00:00.000Z'),
      ('inv_35_2', ?, ?, 'INV-3502', ?, 'Daw Hla', 80000, 5000, 75000, 75000, 'kpay', 'paid', '2026-09-15', '2026-09-15T14:30:00.000Z');
  `, [businessId, branchId, customerId, businessId, branchId, customerId]);

  (storage as any).db.run(`
    INSERT INTO sessions (
      id, business_id, branch_id, room_id, room_name, customer_name, start_time, end_time, duration_minutes,
      total_fee_mmk, status, created_by, created_at
    ) VALUES
      ('sess_35_1', ?, ?, 'room_vip_01', 'VIP Suite 1', 'Daw Hla', '2026-09-01T10:00:00.000Z', '2026-09-01T12:00:00.000Z', 120, 50000, 'completed', 'usr_cashier', '2026-09-01T10:00:00.000Z'),
      ('sess_35_2', ?, ?, 'room_vip_02', 'VIP Suite 2', 'Daw Hla', '2026-09-15T14:30:00.000Z', '2026-09-15T16:30:00.000Z', 120, 75000, 'completed', 'usr_cashier', '2026-09-15T14:30:00.000Z');
  `, [businessId, branchId, businessId, branchId]);

  // 1. Update Customer Preference Profile
  await runTest('1. Set Customer Preferences (Pressure, Temperature, Sensitivities)', async () => {
    const prefs = {
      massagePressure: 'medium',
      roomTemperature: 'warm',
      preferredDrink: 'Warm Ginger Tea with Honey',
      preferredOil: 'Lavender & Lemongrass Aromatherapy',
      sensitivitiesAndAllergies: 'Mild sensitive skin on back, avoid eucalyptus',
      preferredStaffName: 'Ko Zaw (Senior Therapist)',
      specialRequests: 'Extra pillow for lower back comfort',
    };

    const res = await storage.executeCustomerPreferencesUpdate({
      customerId,
      businessId,
      branchId,
      preferences: prefs,
      userId,
      userName,
    });

    assert(res.success === true, 'Preferences updated successfully');

    const profile = storage.getCustomerFinancialProfile(businessId, customerId, true);
    assert(profile !== null, 'Customer profile found');
    const storedPrefs = JSON.parse(profile.customer.preferences || '{}');
    assert(storedPrefs.massagePressure === 'medium', 'Stored massage pressure is medium');
    assert(storedPrefs.preferredDrink === 'Warm Ginger Tea with Honey', 'Stored drink preference matches');
  });

  // 2. Create Public Clinical/Service Note
  const noteId1 = 'note_35_pub_01';
  await runTest('2. Create Public Service Note for Therapist team', async () => {
    const res = await storage.executeCustomerNoteCreate({
      noteId: noteId1,
      businessId,
      branchId,
      customerId,
      customerName: 'Daw Hla',
      category: 'treatment',
      title: 'Shoulder Tension Relief Treatment',
      content: 'Client requested focus on left trapezius and shoulder blade. Responded well to medium pressure.',
      tags: ['shoulder_pain', 'medium_pressure', 'aromatherapy'],
      focusAreas: ['left_shoulder', 'neck', 'upper_back'],
      isPrivate: false,
      userId,
      userName,
    });

    assert(res.success === true, 'Public note created');
  });

  // 3. Create Private Manager Note
  const noteId2 = 'note_35_priv_02';
  await runTest('3. Create Confidential VIP / Private Note (Manager Only)', async () => {
    const res = await storage.executeCustomerNoteCreate({
      noteId: noteId2,
      businessId,
      branchId,
      customerId,
      customerName: 'Daw Hla',
      category: 'preference',
      title: 'VIP Relationship & Billing Preference',
      content: 'Client prefers direct manager greetings and prompt invoice printing. Monthly company settlement.',
      isPrivate: true,
      userId,
      userName,
    });

    assert(res.success === true, 'Private note created');
  });

  // 4. Role-based Privacy Filtering
  await runTest('4. Role-Based Privacy Filtering (Staff sees only public notes, Manager sees all)', async () => {
    // Staff view (canViewSensitive = false)
    const staffNotes = storage.getCustomerServiceNotes(businessId, customerId, false);
    assert(staffNotes.length === 1, 'Staff sees exactly 1 public note');
    assert(staffNotes[0].id === noteId1, 'Staff sees public note only');

    // Manager view (canViewSensitive = true)
    const managerNotes = storage.getCustomerServiceNotes(businessId, customerId, true);
    assert(managerNotes.length === 2, 'Manager sees both public and confidential notes');
  });

  // 5. Update Service Note
  await runTest('5. Update Existing Service Note with Follow-up Action', async () => {
    const res = await storage.executeCustomerNoteUpdate({
      noteId: noteId1,
      businessId,
      branchId,
      category: 'follow_up',
      title: 'Shoulder Treatment - Follow-up Recommended',
      content: 'Updated: Left trapezius softened. Recommend 90-min hot stone therapy on next booking.',
      tags: ['shoulder_pain', 'hot_stone_recommended'],
      userId,
      userName,
    });

    assert(res.success === true, 'Note updated');
    const notes = storage.getCustomerServiceNotes(businessId, customerId, true);
    const updated = notes.find((n: any) => n.id === noteId1);
    assert(updated.category === 'follow_up', 'Category updated to follow_up');
    assert(updated.title.includes('Follow-up Recommended'), 'Title updated');
  });

  // 6. Delete Note
  await runTest('6. Delete Service Note', async () => {
    const tempNoteId = 'note_35_temp_03';
    await storage.executeCustomerNoteCreate({
      noteId: tempNoteId,
      businessId,
      branchId,
      customerId,
      category: 'general',
      title: 'Temporary draft note',
      content: 'To be discarded',
      isPrivate: false,
      userId,
      userName,
    });

    const delRes = await storage.executeCustomerNoteDelete({
      noteId: tempNoteId,
      businessId,
      branchId,
      userId,
      userName,
    });
    assert(delRes.deleted === true, 'Note deleted successfully');

    const notes = storage.getCustomerServiceNotes(businessId, customerId, true);
    assert(!notes.some((n: any) => n.id === tempNoteId), 'Deleted note is gone');
  });

  // 7. Customer 360 Aggregated Profile
  await runTest('7. Customer 360 Comprehensive Profile Aggregation', async () => {
    const profile = storage.getCustomerFinancialProfile(businessId, customerId, true);
    assert(profile !== null, 'Profile retrieved');
    assert(profile.customer.name === 'Daw Hla', 'Customer name matches');
    assert(profile.customer.outstanding_balance_mmk === 15000, 'Outstanding credit debt 15,000 MMK');
    assert(profile.invoices.length === 2, '2 historical invoices loaded');
    assert(profile.sessions.length === 2, '2 historical sessions loaded');
    assert(profile.notes.length === 2, '2 notes attached');
  });

  console.log('======================================================');
  console.log(`PHASE 35 COMPLETED: ${testPassed}/${testPassed + testFailed} TESTS PASSED`);
  console.log('======================================================');

  if (testFailed > 0) {
    throw new Error(`Phase 35 tests failed with ${testFailed} failures.`);
  }
}

runPhase35Tests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
