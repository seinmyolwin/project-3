/**
 * ============================================================================
 * PHASE 24 - STEP 2: TARGETED VERIFICATION TEST
 * ============================================================================
 * Focus: Realtime Event Bus, Deduplication, Sequence Tracking & Gap Handling
 */

import { realtimeClient } from '../src/services/realtimeClient';

let passed = 0;
let total = 0;

function assert(condition: boolean, desc: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ [PASS] ${desc}`);
  } else {
    console.error(`  ❌ [FAIL] ${desc}`);
    throw new Error(`Assertion failed: ${desc}`);
  }
}

async function runStep2Targeted() {
  console.log('================================================================');
  console.log('PHASE 24 - STEP 2 TARGETED VERIFICATION: REALTIME EVENT CLIENT');
  console.log('================================================================\n');

  // 1. Initial State & Subscriptions
  console.log('[1. Connection State Subscriptions]');
  let initialConnectedState: boolean | undefined;
  const unsubscribeState = realtimeClient.onConnectionStateChange((connected) => {
    initialConnectedState = connected;
  });

  assert(initialConnectedState === false, 'RealtimeClient starts in disconnected state initially');
  assert(realtimeClient.getLastSequence() === 0, 'Initial sequence number starts at 0');

  // 2. Message Parsing, Deduplication & Event Dispatch
  console.log('\n[2. Message Parsing & Deduplication]');
  const receivedEvents: any[] = [];
  const unsubscribeEvent = realtimeClient.onEvent((ev) => {
    receivedEvents.push(ev);
  });

  // Simulate raw WS event messages via private handleMessage
  const handleMsg = (realtimeClient as any).handleMessage.bind(realtimeClient);

  // Send Event 1
  handleMsg(JSON.stringify({
    type: 'EVENT',
    event: {
      eventId: 'evt_001',
      sequence: 1,
      eventType: 'ROOM_STATUS_CHANGED',
      businessId: 'biz_01',
      payload: { roomId: 'r1', status: 'occupied' },
    },
  }));

  assert(receivedEvents.length === 1, 'First event received and dispatched to listener');
  assert(realtimeClient.getLastSequence() === 1, 'Sequence updated to 1');

  // Send Duplicate Event 1
  handleMsg(JSON.stringify({
    type: 'EVENT',
    event: {
      eventId: 'evt_001',
      sequence: 1,
      eventType: 'ROOM_STATUS_CHANGED',
      businessId: 'biz_01',
      payload: { roomId: 'r1', status: 'occupied' },
    },
  }));

  assert(receivedEvents.length === 1, 'Duplicate event with same eventId successfully ignored');

  // 3. Sequence Gap Detection
  console.log('\n[3. Sequence Gap Detection]');
  let detectedGap: { expected: number; received: number } | null = null;
  const unsubscribeGap = realtimeClient.onSequenceGap((gap: { expected: number; received: number }) => {
    detectedGap = gap;
  });

  // Jump from sequence 1 to sequence 4
  handleMsg(JSON.stringify({
    type: 'EVENT',
    event: {
      eventId: 'evt_004',
      sequence: 4,
      eventType: 'ROOM_STATUS_CHANGED',
      businessId: 'biz_01',
      payload: { roomId: 'r1', status: 'available' },
    },
  }));

  assert(detectedGap !== null, 'Sequence gap callback triggered on missing intermediate sequences');
  assert((detectedGap as any)?.expected === 2, 'Expected sequence 2 correctly identified');
  assert((detectedGap as any)?.received === 4, 'Received sequence 4 correctly identified');
  assert(realtimeClient.getLastSequence() === 4, 'Last sequence updated to latest seen (4)');

  // 4. Heartbeat PONG and Auth Success Message Handling
  console.log('\n[4. Control Message Handling]');
  handleMsg(JSON.stringify({ type: 'PONG' }));
  handleMsg(JSON.stringify({ type: 'AUTH_SUCCESS', lastSequence: 10 }));
  assert(realtimeClient.getLastSequence() === 10, 'AUTH_SUCCESS successfully synchronizes baseline sequence');

  // Cleanup subscriptions
  unsubscribeState();
  unsubscribeEvent();
  unsubscribeGap();

  console.log('\n================================================================');
  console.log(`STEP 2 TARGETED VERIFICATION COMPLETED: ${passed}/${total} CHECKS PASSED`);
  console.log('================================================================\n');
}

runStep2Targeted().catch(err => {
  console.error('Step 2 targeted check failed:', err);
  process.exit(1);
});
