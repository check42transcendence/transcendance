
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  closeTestDatabase,
  resetTestDatabase,
  testDatabase,
} from './test-database.js';

type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

describe('Invitation database constraints', () => {
  let ownerId: string;
  let inviteeId: string;
  let tripId: string;

  // Create a user for database tests.
  async function createTestUser(username: string): Promise<string> {
    const userId = randomUUID();

    await testDatabase.query(
      `INSERT INTO "user" ("id", "email", "username", "password_hash")
       VALUES ($1, $2, $3, $4)`,
      [userId, `${username}@example.invalid`, username, 'test-placeholder'],
    );

    return userId;
  }

  // Create a Trip belonging to the test owner.
  async function createTestTrip(): Promise<string> {
    const result = await testDatabase.query<{ id: string }>(
      `INSERT INTO "trip"
         ("title", "destination", "start_date", "end_date", "created_by")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING "id"`,
      ['Test trip', 'Paris', '2026-11-03', '2026-11-04', ownerId],
    );

    return result.rows[0].id;
  }

  // Create an invitation with the requested status.
  async function createInvitation(
    options: {
      status?: InvitationStatus;
      targetTripId?: string;
      targetInvitedBy?: string;
      targetInviteeId?: string;
    } = {},
  ): Promise<string> {
    const {
      status = 'PENDING',
      targetTripId = tripId,
      targetInvitedBy = ownerId,
      targetInviteeId = inviteeId,
    } = options;

    const result = await testDatabase.query<{ id: string }>(
      `INSERT INTO "trip_invitation"
         ("trip_id", "invited_by", "invitee_id", "status")
       VALUES ($1, $2, $3, $4)
       RETURNING "id"`,
      [targetTripId, targetInvitedBy, targetInviteeId, status],
    );

    return result.rows[0].id;
  }

  // Reset the database and prepare users and a Trip before each test.
  beforeEach(async () => {
    await resetTestDatabase();

    ownerId = await createTestUser('invitation-owner');
    inviteeId = await createTestUser('invitation-invitee');
    tripId = await createTestTrip();
  });

  // Clean up test data and close the database connection.
  afterAll(async () => {
    try {
      await resetTestDatabase();
    } finally {
      await closeTestDatabase();
    }
  });

  // New invitations use PENDING and database-generated timestamps.
  it('creates an invitation with default status and timestamps', async () => {
    const result = await testDatabase.query<{
      status: string;
      created_at: Date;
      responded_at: Date | null;
    }>(
      `INSERT INTO "trip_invitation"
         ("trip_id", "invited_by", "invitee_id")
       VALUES ($1, $2, $3)
       RETURNING "status", "created_at", "responded_at"`,
      [tripId, ownerId, inviteeId],
    );

    expect(result.rows[0].status).toBe('PENDING');
    expect(result.rows[0].created_at).toBeInstanceOf(Date);
    expect(result.rows[0].responded_at).toBeNull();
  });

  // Reject a second pending invitation for the same Trip and invitee.
  it('rejects duplicate pending invitations for the same Trip and invitee', async () => {
    await createInvitation();

    await expect(createInvitation()).rejects.toMatchObject({
      code: '23505',
      constraint: 'trip_invitation_one_pending_per_trip_invitee',
    });
  });

  // A rejected invitation must not prevent a new pending invitation.
  it('allows re-inviting after the previous invitation was rejected', async () => {
    const rejectedId = await createInvitation({
      status: 'REJECTED',
    });

    await testDatabase.query(
      `UPDATE "trip_invitation"
       SET "responded_at" = CURRENT_TIMESTAMP
       WHERE "id" = $1`,
      [rejectedId],
    );

    const pendingId = await createInvitation();

    const result = await testDatabase.query<{ status: string }>(
      `SELECT "status"
       FROM "trip_invitation"
       WHERE "id" = ANY($1::uuid[])`,
      [[rejectedId, pendingId]],
    );

    expect(result.rows.map((row) => row.status).sort()).toEqual([
      'PENDING',
      'REJECTED',
    ]);
  });

  // Accepted and rejected history must not conflict with the pending-only index.
  it('preserves multiple historical invitations and one current pending invitation', async () => {
    await createInvitation({ status: 'REJECTED' });
    await createInvitation({ status: 'REJECTED' });
    await createInvitation({ status: 'ACCEPTED' });
    await createInvitation({ status: 'PENDING' });

    const result = await testDatabase.query<{
      status: string;
      count: number;
    }>(
      `SELECT "status", COUNT(*)::int AS "count"
       FROM "trip_invitation"
       GROUP BY "status"`,
    );

    const counts = Object.fromEntries(
      result.rows.map((row) => [row.status, row.count]),
    );

    expect(counts).toEqual({
      REJECTED: 2,
      ACCEPTED: 1,
      PENDING: 1,
    });
  });

  // Reject an invitation referencing a nonexistent Trip.
  it('rejects an invitation referencing a nonexistent Trip', async () => {
    await expect(
      createInvitation({
        targetTripId: randomUUID(),
      }),
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'trip_invitation_trip_id_fkey',
    });
  });

  // Reject an invitation referencing a nonexistent inviter.
  it('rejects an invitation referencing a nonexistent inviter', async () => {
    await expect(
      createInvitation({
        targetInvitedBy: randomUUID(),
      }),
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'trip_invitation_invited_by_fkey',
    });
  });

  // Reject an invitation referencing a nonexistent invitee.
  it('rejects an invitation referencing a nonexistent invitee', async () => {
    await expect(
      createInvitation({
        targetInviteeId: randomUUID(),
      }),
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'trip_invitation_invitee_id_fkey',
    });
  });

  // Deleting a Trip removes its invitations but preserves User accounts.
  it('deletes invitations with their Trip but preserves users', async () => {
    await createInvitation();

    await testDatabase.query(
      `DELETE FROM "trip" WHERE "id" = $1`,
      [tripId],
    );

    const invitations = await testDatabase.query(
      `SELECT "id"
       FROM "trip_invitation"
       WHERE "trip_id" = $1`,
      [tripId],
    );

    const users = await testDatabase.query(
      `SELECT "id"
       FROM "user"
       WHERE "id" IN ($1, $2)`,
      [ownerId, inviteeId],
    );

    expect(invitations.rows).toHaveLength(0);
    expect(users.rows).toHaveLength(2);
  });
});
