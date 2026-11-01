
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  closeTestDatabase,
  resetTestDatabase,
  testDatabase,
} from './test-database.js';

describe('Proposal database constraints', () => {
  let creatorId: string;
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

  // Create a Trip that Proposals can belong to.
  async function createTestTrip(): Promise<string> {
    const result = await testDatabase.query<{ id: string }>(
      `INSERT INTO "trip"
         ("title", "destination", "start_date", "end_date", "created_by")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING "id"`,
      ['Test trip', 'Paris', '2026-11-03', '2026-11-04', creatorId],
    );

    return result.rows[0].id;
  }

  // Create a Proposal using database defaults.
  async function createTestProposal(): Promise<string> {
    const result = await testDatabase.query<{ id: string }>(
      `INSERT INTO "proposal" ("trip_id", "title", "created_by")
       VALUES ($1, $2, $3)
       RETURNING "id"`,
      [tripId, 'Visit Louvre', creatorId],
    );

    return result.rows[0].id;
  }

  // Each test starts with fresh data.
  beforeEach(async () => {
    await resetTestDatabase();
    creatorId = await createTestUser('proposal-creator');
    tripId = await createTestTrip();
  });

  afterAll(async () => {
    try {
      await resetTestDatabase();
    } finally {
      await closeTestDatabase();
    }
  });

  it('creates a Proposal with default PENDING status', async () => {
    const proposalId = await createTestProposal();

    const result = await testDatabase.query<{
      id: string;
      status: string;
      description: string | null;
      created_at: Date;
    }>(
      `SELECT "id", "status", "description", "created_at"
       FROM "proposal"
       WHERE "id" = $1`,
      [proposalId],
    );

    expect(result.rows[0].id).toBe(proposalId);
    expect(result.rows[0].status).toBe('PENDING');
    expect(result.rows[0].description).toBeNull();
    expect(result.rows[0].created_at).toBeInstanceOf(Date);
  });

  it('rejects a Proposal referencing a nonexistent Trip', async () => {
    await expect(
      testDatabase.query(
        `INSERT INTO "proposal" ("trip_id", "title", "created_by")
         VALUES ($1, $2, $3)`,
        [randomUUID(), 'Invalid trip', creatorId],
      ),
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'proposal_trip_id_fkey',
    });
  });

  it('rejects a Proposal referencing a nonexistent creator', async () => {
    await expect(
      testDatabase.query(
        `INSERT INTO "proposal" ("trip_id", "title", "created_by")
         VALUES ($1, $2, $3)`,
        [tripId, 'Invalid creator', randomUUID()],
      ),
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'proposal_created_by_fkey',
    });
  });

  it('allows AGREE and REJECT votes from different users', async () => {
    const proposalId = await createTestProposal();
    const secondUserId = await createTestUser('second-voter');

    await testDatabase.query(
      `INSERT INTO "proposal_vote" ("proposal_id", "user_id", "decision")
       VALUES ($1, $2, $3), ($1, $4, $5)`,
      [proposalId, creatorId, 'AGREE', secondUserId, 'REJECT'],
    );

    const result = await testDatabase.query<{ decision: string }>(
      `SELECT "decision"
       FROM "proposal_vote"
       WHERE "proposal_id" = $1
       ORDER BY "decision"`,
      [proposalId],
    );

    expect(result.rows.map((row) => row.decision)).toEqual([
      'AGREE',
      'REJECT',
    ]);
  });

  it('rejects a duplicate Vote for the same Proposal and User', async () => {
    const proposalId = await createTestProposal();

    await testDatabase.query(
      `INSERT INTO "proposal_vote" ("proposal_id", "user_id", "decision")
       VALUES ($1, $2, $3)`,
      [proposalId, creatorId, 'AGREE'],
    );

    await expect(
      testDatabase.query(
        `INSERT INTO "proposal_vote" ("proposal_id", "user_id", "decision")
         VALUES ($1, $2, $3)`,
        [proposalId, creatorId, 'REJECT'],
      ),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'proposal_vote_proposal_id_user_id_key',
    });
  });

  it('allows changing an existing Vote decision', async () => {
    const proposalId = await createTestProposal();

    await testDatabase.query(
      `INSERT INTO "proposal_vote" ("proposal_id", "user_id", "decision")
       VALUES ($1, $2, 'AGREE')`,
      [proposalId, creatorId],
    );

    await testDatabase.query(
      `UPDATE "proposal_vote"
       SET "decision" = 'REJECT', "voted_at" = CURRENT_TIMESTAMP
       WHERE "proposal_id" = $1 AND "user_id" = $2`,
      [proposalId, creatorId],
    );

    const result = await testDatabase.query<{
      decision: string;
      count: string;
    }>(
      `SELECT MAX("decision"::text) AS "decision",
              COUNT(*)::text AS "count"
       FROM "proposal_vote"
       WHERE "proposal_id" = $1 AND "user_id" = $2`,
      [proposalId, creatorId],
    );

    expect(result.rows[0].decision).toBe('REJECT');
    expect(result.rows[0].count).toBe('1');
  });

  it('rejects a Vote referencing a nonexistent Proposal', async () => {
    await expect(
      testDatabase.query(
        `INSERT INTO "proposal_vote" ("proposal_id", "user_id", "decision")
         VALUES ($1, $2, 'AGREE')`,
        [randomUUID(), creatorId],
      ),
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'proposal_vote_proposal_id_fkey',
    });
  });

  it('rejects a Vote referencing a nonexistent User', async () => {
    const proposalId = await createTestProposal();

    await expect(
      testDatabase.query(
        `INSERT INTO "proposal_vote" ("proposal_id", "user_id", "decision")
         VALUES ($1, $2, 'AGREE')`,
        [proposalId, randomUUID()],
      ),
    ).rejects.toMatchObject({
      code: '23503',
      constraint: 'proposal_vote_user_id_fkey',
    });
  });

  it('deletes Proposals and Votes with their Trip but preserves Users', async () => {
    const proposalId = await createTestProposal();

    await testDatabase.query(
      `INSERT INTO "proposal_vote" ("proposal_id", "user_id", "decision")
       VALUES ($1, $2, 'AGREE')`,
      [proposalId, creatorId],
    );

    await testDatabase.query(
      `DELETE FROM "trip" WHERE "id" = $1`,
      [tripId],
    );

    const proposals = await testDatabase.query(
      `SELECT "id" FROM "proposal" WHERE "id" = $1`,
      [proposalId],
    );

    const votes = await testDatabase.query(
      `SELECT "id" FROM "proposal_vote" WHERE "proposal_id" = $1`,
      [proposalId],
    );

    const users = await testDatabase.query(
      `SELECT "id" FROM "user" WHERE "id" = $1`,
      [creatorId],
    );

    expect(proposals.rows).toHaveLength(0);
    expect(votes.rows).toHaveLength(0);
    expect(users.rows).toHaveLength(1);
  });
});
