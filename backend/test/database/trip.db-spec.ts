import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  closeTestDatabase,
  resetTestDatabase,
  testDatabase,
} from './test-database.js';

describe('Trip database constraints', () => {
  let creatorId: string;

  // Create a test user and return the user ID.
  async function createTestUser(username: string): Promise<string> {
    const userId = randomUUID();

    await testDatabase.query(
      `INSERT INTO "user" ("id", "email", "username", "password_hash")
       VALUES ($1, $2, $3, $4)`,
      [userId, `${username}@example.invalid`, username, 'test-placeholder'],
    );

    return userId;
  }

  // Create a trip for the test creator without adding memberships or days.
  async function createTestTrip(
    startDate = '2026-11-03',
    endDate = startDate,
  ): Promise<string> {
    const result = await testDatabase.query<{ id: string }>(
      `INSERT INTO "trip"
         ("title", "destination", "start_date", "end_date", "created_by")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING "id"`,
      ['Test trip', 'Paris', startDate, endDate, creatorId],
    );

    return result.rows[0].id;
  }

  // Clear test data and create a trip creator before each test.
  beforeEach(async () => {
    await resetTestDatabase();
    creatorId = await createTestUser('trip-test');
  });

  // Clear test data and close connections after all tests.
  afterAll(async () => {
    try {
      await resetTestDatabase();
    } finally {
      await closeTestDatabase();
    }
  });

  // Reject trips whose end date is earlier than the start date.
  it('rejects a trip ending before its start date', async () => {
    await expect(
      testDatabase.query(
        `INSERT INTO "trip"
                ("title", "destination", "start_date", "end_date", "created_by")
                VALUES ($1, $2, $3, $4, $5)`,
        ['Test trip', 'Paris', '2026-11-03', '2026-11-01', creatorId],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'trip_date_range_check',
    });
  });

  // Allow the start and end dates to be the same.
  it('allows a single-day trip', async () => {
    const result = await testDatabase.query(
      `INSERT INTO "trip"
            ("title", "destination", "start_date", "end_date", "created_by")
            VALUES ($1, $2, $3, $4, $5)
            RETURNING "id"`,
      ['Test trip', 'Paris', '2026-11-03', '2026-11-03', creatorId],
    );

    expect(result.rows).toHaveLength(1);
  });

  // Reject day numbers below 1.
  it('rejects a day number below 1', async () => {
    const tripId = await createTestTrip();

    await expect(
      testDatabase.query(
        `INSERT INTO "itinerary_day"
                ("trip_id", "day_number", "date")
                VALUES ($1, $2, $3)`,
        [tripId, 0, '2026-11-03'],
      ),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'itinerary_day_number_check',
    });
  });

  // Reject duplicate memberships for the same user and trip.
  it('rejects duplicate membership for the same trip and user', async () => {
    const tripId = await createTestTrip();

    await testDatabase.query(
      `INSERT INTO "trip_member"
                ("trip_id", "user_id", "role")
                VALUES ($1, $2, $3)`,
      [tripId, creatorId, 'MEMBER'],
    );

    await expect(
      testDatabase.query(
        `INSERT INTO "trip_member"
                ("trip_id", "user_id", "role")
                VALUES ($1, $2, $3)`,
        [tripId, creatorId, 'MEMBER'],
      ),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'trip_member_trip_id_user_id_key',
    });
  });

  // Reject a second owner for the same trip.
  it('rejects a second owner for the same trip', async () => {
    const secondUserId = await createTestUser('second-user');

    const tripId = await createTestTrip();

    await testDatabase.query(
      `INSERT INTO "trip_member"
            ("trip_id", "user_id", "role")
            VALUES ($1, $2, $3)`,
      [tripId, creatorId, 'OWNER'],
    );

    await expect(
      testDatabase.query(
        `INSERT INTO "trip_member"
            ("trip_id", "user_id", "role")
            VALUES ($1, $2, $3)`,
        [tripId, secondUserId, 'OWNER'],
      ),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'trip_member_one_owner_per_trip',
    });
  });

  // Allow one owner and multiple ordinary members.
  it('allows one owner and multiple members in the same trip', async () => {
    const secondUserId = await createTestUser('second-user');

    const thirdUserId = await createTestUser('third-user');

    const tripId = await createTestTrip();

    await testDatabase.query(
      `INSERT INTO "trip_member"
            ("trip_id", "user_id", "role")
            VALUES ($1, $2, $3)`,
      [tripId, creatorId, 'OWNER'],
    );

    await testDatabase.query(
      `INSERT INTO "trip_member"
            ("trip_id", "user_id", "role")
            VALUES ($1, $2, $3)`,
      [tripId, secondUserId, 'MEMBER'],
    );

    await testDatabase.query(
      `INSERT INTO "trip_member"
            ("trip_id", "user_id", "role")
            VALUES ($1, $2, $3)`,
      [tripId, thirdUserId, 'MEMBER'],
    );

    const result = await testDatabase.query(
      `SELECT "id" FROM "trip_member" WHERE "trip_id" = $1`,
      [tripId],
    );

    expect(result.rows).toHaveLength(3);
  });

  // Reject duplicate day numbers within one trip.
  it('rejects duplicate day numbers within the same trip', async () => {
    const tripId = await createTestTrip('2026-11-03', '2026-11-04');

    await testDatabase.query(
      `INSERT INTO "itinerary_day"
            ("trip_id", "day_number", "date")
            VALUES ($1, $2, $3)`,
      [tripId, 1, '2026-11-03'],
    );

    await expect(
      testDatabase.query(
        `INSERT INTO "itinerary_day"
            ("trip_id", "day_number", "date")
            VALUES ($1, $2, $3)`,
        [tripId, 1, '2026-11-04'],
      ),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'itinerary_day_trip_id_day_number_key',
    });
  });

  // Reject duplicate dates within one trip.
  it('rejects duplicate dates within the same trip', async () => {
    const tripId = await createTestTrip('2026-11-03', '2026-11-04');

    await testDatabase.query(
      `INSERT INTO "itinerary_day"
            ("trip_id", "day_number", "date")
            VALUES ($1, $2, $3)`,
      [tripId, 1, '2026-11-03'],
    );

    await expect(
      testDatabase.query(
        `INSERT INTO "itinerary_day"
            ("trip_id", "day_number", "date")
            VALUES ($1, $2, $3)`,
        [tripId, 2, '2026-11-03'],
      ),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'itinerary_day_trip_id_date_key',
    });
  });

  // Delete trip data while preserving user accounts.
  it('deletes memberships and days with the trip but preserves users', async () => {
    const tripId = await createTestTrip('2026-11-03', '2026-11-04');

    await testDatabase.query(
      `INSERT INTO "trip_member"
            ("trip_id", "user_id", "role")
            VALUES ($1, $2, $3)`,
      [tripId, creatorId, 'OWNER'],
    );

    await testDatabase.query(
      `INSERT INTO "itinerary_day"
            ("trip_id", "day_number", "date")
            VALUES ($1, $2, $3)`,
      [tripId, 1, '2026-11-03'],
    );

    await testDatabase.query(`DELETE FROM "trip" WHERE "id" = $1`, [tripId]);

    // Memberships are deleted automatically.
    const membersResult = await testDatabase.query(
      `SELECT "id" FROM "trip_member" WHERE "trip_id" = $1`,
      [tripId],
    );
    expect(membersResult.rows).toHaveLength(0);

    // Days are deleted automatically.
    const daysResult = await testDatabase.query(
      `SELECT "id" FROM "itinerary_day" WHERE "trip_id" = $1`,
      [tripId],
    );
    expect(daysResult.rows).toHaveLength(0);

    // The user account is preserved.
    const usersResult = await testDatabase.query(
      `SELECT "id" FROM "user" WHERE "id" = $1`,
      [creatorId],
    );
    expect(usersResult.rows).toHaveLength(1);
  });
});
