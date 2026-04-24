# Security Specification - WorkSync Attendance

## Data Invariants
1. A user profile MUST be owned by the user (UID matches document ID).
2. Roles (`employee`, `manager`) can only be assigned by existing managers or defaults to `employee` on creation. *Actually, for this demo, I'll allow the first user to be manager? No, I'll stick to secure defaults: once set, roles are immutable by the user.*
3. Attendance logs MUST have a `userId` matching the authenticated user.
4. Attendance logs are immutable after creation (deletion/update not usually allowed for compliance, but we'll allow specific manager overrides if requested).

## The Dirty Dozen Payloads

1. **Identity Spoofing**: User A trying to create a profile for User B.
2. **Privilege Escalation**: User A trying to update their own `role` to `manager`.
3. **Ghost Attendance**: User A trying to log attendance for User B.
4. **Future Logging**: User A trying to log attendance for next week (Time validation).
5. **Log Tampering**: User A trying to change a 'LEAVE' log to 'WFO' for a past date.
6. **Query Scraping**: Authenticated User A trying to list all attendance logs without filters (denied unless manager).
7. **Malformed IDs**: Using a 1MB string as a userId.
8. **Shadow Fields**: Adding `isVerified: true` to an attendance log.
9. **PII Leak**: Non-manager trying to read another user's profile.
10. **Orphaned Logs**: Creating a log for a userId that doesn't exist in `users`.
11. **Action Injection**: Overwriting `userName` in a log to something else.
12. **System Bypass**: Trying to update `timestamp` to a client-side date instead of `serverTimestamp()`.

## Test Runner Plan
We will implement `firestore.rules.test.ts` using the Firebase Rules Unit Testing library.

*Note: For this environment, we'll focus on the rules logic.*
