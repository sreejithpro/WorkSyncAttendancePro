import { 
  assertFails, 
  assertSucceeds, 
  initializeTestEnvironment, 
  RulesTestEnvironment 
} from '@firebase/rules-unit-testing';
import { setDoc, getDoc, collection, addDoc, serverTimestamp, query, getDocs } from 'firebase/firestore';
import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import * as fs from 'fs';

let testEnv: RulesTestEnvironment;

describe('WorkSync Attendance Security Rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'worksync-test-project',
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it('DD1: Identity Spoofing - Deny user A creating profile for user B', async () => {
    const alice = testEnv.authenticatedContext('alice');
    const profileRef = alice.firestore().doc('users/bob');
    await assertFails(setDoc(profileRef, {
      uid: 'bob',
      name: 'Bob',
      email: 'bob@example.com',
      role: 'employee'
    }));
  });

  it('DD2: Privilege Escalation - Deny user A promoting themselves to manager', async () => {
    const alice = testEnv.authenticatedContext('alice');
    const profileRef = alice.firestore().doc('users/alice');
    
    // Initial setup (succeeds as employee)
    await assertSucceeds(setDoc(profileRef, {
      uid: 'alice',
      name: 'Alice',
      email: 'alice@example.com',
      role: 'employee'
    }));

    // Try to update role to manager
    await assertFails(setDoc(profileRef, {
      uid: 'alice',
      name: 'Alice',
      email: 'alice@example.com',
      role: 'manager'
    }));
  });

  it('DD3: Ghost Attendance - Deny user A logging for user B', async () => {
    const alice = testEnv.authenticatedContext('alice');
    const logRef = alice.firestore().collection('attendance').doc('log123');
    await assertFails(setDoc(logRef, {
      userId: 'bob',
      userName: 'Bob',
      userEmail: 'bob@example.com',
      date: '2026-04-24',
      type: 'WFO',
      timestamp: serverTimestamp()
    }));
  });

  it('DD4: Future Logging - (Handled by timestamp validation)', async () => {
    const alice = testEnv.authenticatedContext('alice');
    const logRef = alice.firestore().collection('attendance').doc('log123');
    // Rules enforcement for timestamp == request.time
    await assertFails(setDoc(logRef, {
      userId: 'alice',
      userName: 'Alice',
      userEmail: 'alice@example.com',
      date: '2026-04-24',
      type: 'WFO',
      timestamp: new Date('2026-12-31') // Future date
    }));
  });

  it('DD6: Query Scraping - Deny non-manager listing all logs', async () => {
    const alice = testEnv.authenticatedContext('alice');
    const q = query(alice.firestore().collection('attendance'));
    await assertFails(getDocs(q));
  });

  it('DD8: Shadow Fields - Deny adding isVerified to log', async () => {
    const alice = testEnv.authenticatedContext('alice');
    const logRef = alice.firestore().collection('attendance').doc('log123');
    await assertFails(setDoc(logRef, {
      userId: 'alice',
      userName: 'Alice',
      userEmail: 'alice@example.com',
      date: '2026-04-24',
      type: 'WFO',
      timestamp: serverTimestamp(),
      isVerified: true // Shadow field
    }));
  });
});
