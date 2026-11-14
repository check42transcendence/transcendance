import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertTestDatabaseUrl } from '../scripts/test-database-url.mjs';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { RealtimeService } from '../src/realtime/realtime.service.js';
import { TripsService } from '../src/trips/trips.service.js';

// Exercise HTTP validation, identity, and responses against a real test database.
describe('Trip HTTP integration', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let realtime: RealtimeService;
  let ownerCookie: string;
  let otherCookie: string;

  const ownerId = randomUUID();
  const otherUserId = randomUUID();
  const userIds = [ownerId, otherUserId];
  const ownerUsername = `owner-${ownerId.slice(0, 8)}`;
  const createInput = {
    title: 'Paris weekend',
    destination: 'Paris',
    startDate: '2026-11-03',
    endDate: '2026-11-04',
    description: null,
  };

  // Start the real application and prepare signed cookies for test users.
  beforeAll(async () => {
    assertTestDatabaseUrl('DATABASE_URL');
    vi.stubEnv('JWT_SECRET', 'local-trip-http-test-secret');

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    realtime = moduleFixture.get(RealtimeService);
    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          email: `${ownerId}@example.invalid`,
          username: ownerUsername,
          passwordHash: 'test-placeholder',
        },
        {
          id: otherUserId,
          email: `${otherUserId}@example.invalid`,
          username: `other-${otherUserId.slice(0, 8)}`,
          passwordHash: 'test-placeholder',
        },
      ],
    });

    // Use real JWT verification without repeating the login/password tests.
    const jwtService = moduleFixture.get(JwtService);
    ownerCookie = `token=${await jwtService.signAsync({ sub: ownerId })}`;
    otherCookie = `token=${await jwtService.signAsync({ sub: otherUserId })}`;
  });

  // Remove only this file's records, then close the application.
  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.trip.deleteMany({
          where: { createdBy: { in: userIds } },
        });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    } finally {
      try {
        await app?.close();
      } finally {
        vi.unstubAllEnvs();
      }
    }
  });

  // Return 201 and the public detail using identity from the verified cookie.
  it('creates a trip through HTTP with the expected public response', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/trips')
      .set('Cookie', ownerCookie)
      .send(createInput)
      .expect(201);

    expect(createResponse.body).toEqual({
      trip: {
        id: expect.any(String),
        ...createInput,
        currentUserRole: 'OWNER',
        createdBy: { id: ownerId, username: ownerUsername },
        createdAt: expect.any(String),
      },
    });
  });

// Allow owners and members to read the member list without exposing emails.
  it('returns current trip members without exposing their emails', async () => {
    const createResult = await app
      .get(TripsService)
      .create(ownerId, createInput);

    const tripId = createResult.trip.id;

    await prisma.tripMember.create({
      data: {
        tripId,
        userId: otherUserId,
        role: 'MEMBER',
      },
    });

    // Both the owner and the ordinary member can view the member list.
    for (const cookie of [ownerCookie, otherCookie]) {
      const response = await request(app.getHttpServer())
        .get(`/api/trips/${tripId}/members`)
        .set('Cookie', cookie)
        .expect(200);

      expect(response.body.members).toHaveLength(2);

      expect(response.body.members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            user: {
              id: ownerId,
              username: ownerUsername,
            },
            role: 'OWNER',
            joinedAt: expect.any(String),
          }),
          expect.objectContaining({
            user: {
              id: otherUserId,
              username: `other-${otherUserId.slice(0, 8)}`,
            },
            role: 'MEMBER',
            joinedAt: expect.any(String),
          }),
        ]),
      );

      // Other users' email addresses must never appear in this response.
      for (const member of response.body.members) {
        expect(Object.keys(member.user).sort()).toEqual([
          'id',
          'username',
        ]);
      }
    }
  });
  // Creating a pending invitation must not grant membership or Trip access.
  it('creates a pending invitation without granting membership or access', async () => {
    const createResult = await app
      .get(TripsService)
      .create(ownerId, createInput);
    const tripId = createResult.trip.id;
    const inviteeUsername = `other-${otherUserId.slice(0, 8)}`;

    const response = await request(app.getHttpServer())
      .post(`/api/trips/${tripId}/invitations`)
      .set('Cookie', ownerCookie)
      .send({ username: inviteeUsername.toUpperCase() })
      .expect(201);

    expect(response.body).toEqual({
      invitation: {
        id: expect.any(String),
        status: 'PENDING',
        createdAt: expect.any(String),
      },
    });

    const savedInvitation = await prisma.tripInvitation.findUnique({
      where: { id: response.body.invitation.id },
    });

    expect(savedInvitation).toMatchObject({
      tripId,
      invitedBy: ownerId,
      inviteeId: otherUserId,
      status: 'PENDING',
    });

    // A pending invitation does not create a Trip membership.
    const membership = await prisma.tripMember.findFirst({
      where: { tripId, userId: otherUserId },
    });
    expect(membership).toBeNull();

    const tripNotFound = {
      error: {
        code: 'TRIP_NOT_FOUND',
        message: 'Trip not found',
        details: {},
      },
    };

    // The invitee still cannot read the Trip.
    await request(app.getHttpServer())
      .get(`/api/trips/${tripId}`)
      .set('Cookie', otherCookie)
      .expect(404, tripNotFound);

    await request(app.getHttpServer())
      .get(`/api/trips/${tripId}/members`)
      .set('Cookie', otherCookie)
      .expect(404, tripNotFound);

    // The Trip must also remain absent from the invitee's Trip list.
    const tripList = await request(app.getHttpServer())
      .get('/api/trips')
      .set('Cookie', otherCookie)
      .expect(200);

    expect(
      tripList.body.trips.some(
        (trip: { id: string }) => trip.id === tripId,
      ),
    ).toBe(false);
  });

  // Return only pending invitations received by the authenticated user.
  it('lists only the current user pending invitations without granting access', async () => {
    const inviteeId = randomUUID();
    const inviteeUsername = `recipient-${inviteeId.slice(0, 8)}`;
    const inviteeEmail = `${inviteeId}@example.invalid`;
    userIds.push(inviteeId);

    await prisma.user.create({
      data: {
        id: inviteeId,
        email: inviteeEmail,
        username: inviteeUsername,
        passwordHash: 'test-placeholder',
      },
    });

    const jwtService = app.get(JwtService);
    const inviteeCookie = `token=${await jwtService.signAsync({
      sub: inviteeId,
    })}`;

    // Create one invitation for this recipient.
    const recipientTrip = await app
      .get(TripsService)
      .create(ownerId, createInput);

    const recipientInvitation = await request(app.getHttpServer())
      .post(`/api/trips/${recipientTrip.trip.id}/invitations`)
      .set('Cookie', ownerCookie)
      .send({ email: inviteeEmail })
      .expect(201);

    // Create another invitation for a different recipient.
    const otherTrip = await app
      .get(TripsService)
      .create(ownerId, {
        ...createInput,
        title: 'Another trip',
        destination: 'Lyon',
      });

    const otherInvitation = await request(app.getHttpServer())
      .post(`/api/trips/${otherTrip.trip.id}/invitations`)
      .set('Cookie', ownerCookie)
      .send({ username: `other-${otherUserId.slice(0, 8)}` })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/api/invitations?status=PENDING')
      .set('Cookie', inviteeCookie)
      .expect(200);

    expect(response.body).toEqual({
      invitations: [
        {
          id: recipientInvitation.body.invitation.id,
          status: 'PENDING',
          trip: {
            id: recipientTrip.trip.id,
            title: createInput.title,
            destination: createInput.destination,
            startDate: createInput.startDate,
            endDate: createInput.endDate,
          },
          invitedBy: {
            id: ownerId,
            username: ownerUsername,
          },
          createdAt: expect.any(String),
        },
      ],
    });

    // An invitation for another user must not appear in this response.
    expect(
      response.body.invitations.some(
        (invitation: { id: string }) =>
          invitation.id === otherInvitation.body.invitation.id,
      ),
    ).toBe(false);

    // Receiving an invitation still does not create a membership.
    expect(
      await prisma.tripMember.findFirst({
        where: {
          tripId: recipientTrip.trip.id,
          userId: inviteeId,
        },
      }),
    ).toBeNull();

    const tripNotFound = {
      error: {
        code: 'TRIP_NOT_FOUND',
        message: 'Trip not found',
        details: {},
      },
    };

    await request(app.getHttpServer())
      .get(`/api/trips/${recipientTrip.trip.id}`)
      .set('Cookie', inviteeCookie)
      .expect(404, tripNotFound);

    await request(app.getHttpServer())
      .get(`/api/trips/${recipientTrip.trip.id}/members`)
      .set('Cookie', inviteeCookie)
      .expect(404, tripNotFound);
  });

  // Only the invitation recipient can accept a pending invitation once.
  it('accepts a pending invitation for its recipient and creates one membership', async () => {
    const createResult = await app
      .get(TripsService)
      .create(ownerId, createInput);
    const tripId = createResult.trip.id;

    const invitationResponse = await request(app.getHttpServer())
      .post(`/api/trips/${tripId}/invitations`)
      .set('Cookie', ownerCookie)
      .send({ username: `other-${otherUserId.slice(0, 8)}` })
      .expect(201);

    const invitationId = invitationResponse.body.invitation.id as string;

    // The inviter cannot accept an invitation addressed to another user.
    const wrongUserResponse = await request(app.getHttpServer())
      .post(`/api/invitations/${invitationId}/accept`)
      .set('Cookie', ownerCookie)
      .expect(404);

    expect(wrongUserResponse.body.error.code).toBe('INVITATION_NOT_FOUND');

    // The intended recipient accepts the invitation.
    const acceptResponse = await request(app.getHttpServer())
      .post(`/api/invitations/${invitationId}/accept`)
      .set('Cookie', otherCookie)
      .expect(201);

    expect(acceptResponse.body).toEqual({
      tripId,
      userId: otherUserId,
      role: 'MEMBER',
      joinedAt: expect.any(String),
    });

    const savedInvitation = await prisma.tripInvitation.findUnique({
      where: { id: invitationId },
    });
    expect(savedInvitation).toMatchObject({
      tripId,
      inviteeId: otherUserId,
      status: 'ACCEPTED',
    });
    expect(savedInvitation?.respondedAt).toBeInstanceOf(Date);

    const membership = await prisma.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId,
          userId: otherUserId,
        },
      },
    });

    expect(membership).toMatchObject({
      tripId,
      userId: otherUserId,
      role: 'MEMBER',
    });
    expect(membership?.joinedAt.toISOString()).toBe(
      acceptResponse.body.joinedAt,
    );

    // A repeated Accept must not create another Membership.
    const repeatedResponse = await request(app.getHttpServer())
      .post(`/api/invitations/${invitationId}/accept`)
      .set('Cookie', otherCookie)
      .expect(409);

    expect(repeatedResponse.body.error.code).toBe('INVITATION_NOT_PENDING');

    expect(
      await prisma.tripMember.count({
        where: { tripId, userId: otherUserId },
      }),
    ).toBe(1);
  });

  // Only the invitation recipient can reject a pending invitation once.
  it('rejects a pending invitation without creating membership', async () => {
    const createResult = await app
      .get(TripsService)
      .create(ownerId, createInput);
    const tripId = createResult.trip.id;

    const invitationResponse = await request(app.getHttpServer())
      .post(`/api/trips/${tripId}/invitations`)
      .set('Cookie', ownerCookie)
      .send({ username: `other-${otherUserId.slice(0, 8)}` })
      .expect(201);

    const invitationId = invitationResponse.body.invitation.id as string;

    // The inviter cannot reject an invitation addressed to another user.
    const wrongUserResponse = await request(app.getHttpServer())
      .post(`/api/invitations/${invitationId}/reject`)
      .set('Cookie', ownerCookie)
      .expect(404);

    expect(wrongUserResponse.body.error.code).toBe('INVITATION_NOT_FOUND');

    // The intended recipient rejects the invitation.
    await request(app.getHttpServer())
      .post(`/api/invitations/${invitationId}/reject`)
      .set('Cookie', otherCookie)
      .expect(204);

    const savedInvitation = await prisma.tripInvitation.findUnique({
      where: { id: invitationId },
    });

    expect(savedInvitation).toMatchObject({
      tripId,
      inviteeId: otherUserId,
      status: 'REJECTED',
    });
    expect(savedInvitation?.respondedAt).toBeInstanceOf(Date);

    // Reject must not create a Trip Membership.
    expect(
      await prisma.tripMember.findUnique({
        where: {
          tripId_userId: {
            tripId,
            userId: otherUserId,
          },
        },
      }),
    ).toBeNull();

    // A repeated Reject must be rejected as an invalid transition.
    const repeatedResponse = await request(app.getHttpServer())
      .post(`/api/invitations/${invitationId}/reject`)
      .set('Cookie', otherCookie)
      .expect(409);

    expect(repeatedResponse.body.error.code).toBe('INVITATION_NOT_PENDING');
  });

  // Require the supported PENDING invitation status filter.
  it('rejects missing or unsupported invitation status filters', async () => {
    const validationError = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request input',
        details: {},
      },
    };

    for (const path of [
      '/api/invitations',
      '/api/invitations?status=ACCEPTED',
      '/api/invitations?status=REJECTED',
    ]) {
      await request(app.getHttpServer())
        .get(path)
        .set('Cookie', otherCookie)
        .expect(400, validationError);
    }
  });

  // Reject invalid invitation identifiers and client-supplied fields.
  it('rejects invalid invitation request bodies', async () => {
    const createResult = await app
      .get(TripsService)
      .create(ownerId, createInput);
    const tripId = createResult.trip.id;
    const inviteeUsername = `other-${otherUserId.slice(0, 8)}`;

    const invalidInputs = [
      {},
      {
        username: inviteeUsername,
        email: `${otherUserId}@example.invalid`,
      },
      { username: '   ' },
      { email: 'not-an-email' },
      { username: inviteeUsername, role: 'OWNER' },
    ];

    const validationError = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request input',
        details: {},
      },
    };

    for (const input of invalidInputs) {
      await request(app.getHttpServer())
        .post(`/api/trips/${tripId}/invitations`)
        .set('Cookie', ownerCookie)
        .send(input)
        .expect(400, validationError);
    }

    expect(
      await prisma.tripInvitation.count({ where: { tripId } }),
    ).toBe(0);
  });

  // Enforce Owner permission and invitation conflict rules.
  it('enforces invitation permissions and conflict responses', async () => {
    const createResult = await app
      .get(TripsService)
      .create(ownerId, createInput);
    const tripId = createResult.trip.id;

    const inviteeId = randomUUID();
    const inviteeUsername = `invite-${inviteeId.slice(0, 8)}`;
    userIds.push(inviteeId);

    await prisma.user.create({
      data: {
        id: inviteeId,
        email: `${inviteeId}@example.invalid`,
        username: inviteeUsername,
        passwordHash: 'test-placeholder',
      },
    });

    await prisma.tripMember.create({
      data: {
        tripId,
        userId: otherUserId,
        role: 'MEMBER',
      },
    });

    // An ordinary member cannot create invitations.
    await request(app.getHttpServer())
      .post(`/api/trips/${tripId}/invitations`)
      .set('Cookie', otherCookie)
      .send({ username: inviteeUsername })
      .expect(403, {
        error: {
          code: 'TRIP_OWNER_REQUIRED',
          message: 'Trip owner required',
          details: {},
        },
      });

    // Unknown registered users receive the explicit invitee error.
    await request(app.getHttpServer())
      .post(`/api/trips/${tripId}/invitations`)
      .set('Cookie', ownerCookie)
      .send({ username: `missing-${randomUUID().slice(0, 8)}` })
      .expect(404, {
        error: {
          code: 'INVITEE_NOT_FOUND',
          message: 'Invitee not found',
          details: {},
        },
      });

    // A current member cannot be invited again.
    await request(app.getHttpServer())
      .post(`/api/trips/${tripId}/invitations`)
      .set('Cookie', ownerCookie)
      .send({ username: `other-${otherUserId.slice(0, 8)}` })
      .expect(409, {
        error: {
          code: 'MEMBERSHIP_ALREADY_EXISTS',
          message: 'User is already a trip member',
          details: {},
        },
      });

    // A second pending invitation for the same user is rejected.
    await request(app.getHttpServer())
      .post(`/api/trips/${tripId}/invitations`)
      .set('Cookie', ownerCookie)
      .send({ username: inviteeUsername })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/trips/${tripId}/invitations`)
      .set('Cookie', ownerCookie)
      .send({ email: `${inviteeId}@example.invalid` })
      .expect(409, {
        error: {
          code: 'INVITATION_ALREADY_PENDING',
          message: 'Invitation is already pending',
          details: {},
        },
      });

    expect(
      await prisma.tripInvitation.count({
        where: { tripId, inviteeId, status: 'PENDING' },
      }),
    ).toBe(1);
  });

  // Serialize invitation creation against a concurrent Trip deletion.
  it('returns TRIP_NOT_FOUND instead of 500 when the Trip is deleted during invitation creation', async () => {
    const createResult = await app
      .get(TripsService)
      .create(ownerId, createInput);
    const tripId = createResult.trip.id;

    let lockBackendPid = 0;
    let signalLockAcquired!: () => void;
    const lockAcquired = new Promise<void>((resolve) => {
      signalLockAcquired = resolve;
    });

    let releaseTripLock!: () => void;
    const tripLockReleased = new Promise<void>((resolve) => {
      releaseTripLock = resolve;
    });

    // Hold the Trip row lock to control the order of concurrent requests.
    const lockTransaction = prisma.$transaction(async (tx) => {
      const [backend] = await tx.$queryRaw<Array<{ pid: number }>>`
        SELECT pg_backend_pid() AS pid
      `;
      lockBackendPid = backend.pid;

      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "trip"
        WHERE "id" = ${tripId}::uuid
        FOR UPDATE
      `;

      signalLockAcquired();
      await tripLockReleased;
    });

    await lockAcquired;

    // Wait until a request is actually blocked by the Trip row lock.
    const waitForBlockedQuery = async (
      kind: 'delete' | 'invitation',
    ): Promise<void> => {
      for (let attempt = 0; attempt < 500; attempt += 1) {
        const [activity] = await prisma.$queryRaw<
          Array<{ waiting: boolean }>
        >`
          SELECT EXISTS (
            SELECT 1
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND wait_event_type = 'Lock'
              AND pid <> ${lockBackendPid}
              AND (
                (
                  ${kind} = 'delete'
                  AND query ILIKE '%DELETE%'
                  AND query ILIKE '%trip%'
                )
                OR
                (
                  ${kind} = 'invitation'
                  AND (
                    query ILIKE '%FOR UPDATE%'
                    OR query ILIKE '%trip_invitation%'
                  )
                )
              )
          ) AS waiting
        `;

        if (activity?.waiting) {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      throw new Error(`Timed out waiting for the ${kind} query to block`);
    };

    // Queue deletion first, then queue invitation creation behind it.
    const responses = await (async () => {
      const pendingRequests: Promise<unknown>[] = [];

      try {
        const deletionPromise = request(app.getHttpServer())
          .delete(`/api/trips/${tripId}`)
          .set('Cookie', ownerCookie)
          .then((response) => response);

        pendingRequests.push(deletionPromise);
        await waitForBlockedQuery('delete');

        const invitationPromise = request(app.getHttpServer())
          .post(`/api/trips/${tripId}/invitations`)
          .set('Cookie', ownerCookie)
          .send({ username: `other-${otherUserId.slice(0, 8)}` })
          .then((response) => response);

        pendingRequests.push(invitationPromise);
        await waitForBlockedQuery('invitation');

        // Start collecting responses without waiting while the lock is held.
        return Promise.all([deletionPromise, invitationPromise]);
      } finally {
        // Release the Trip lock before waiting for either HTTP request.
        releaseTripLock();
        await lockTransaction;
        await Promise.allSettled(pendingRequests);
      }
    })();

    const [deletionResponse, invitationResponse] = responses;

    expect(deletionResponse.status).toBe(204);

    expect(invitationResponse.status).toBe(404);
    expect(invitationResponse.body).toEqual({
      error: {
        code: 'TRIP_NOT_FOUND',
        message: 'Trip not found',
        details: {},
      },
    });

    // The Trip and any invitations must be absent after deletion.
    expect(
      await prisma.trip.findUnique({ where: { id: tripId } }),
    ).toBeNull();

    expect(
      await prisma.tripInvitation.count({ where: { tripId } }),
    ).toBe(0);
  });

  // Concurrent duplicate requests must create only one pending invitation.
  it('prevents concurrent duplicate invitation creation', async () => {
    const createResult = await app
      .get(TripsService)
      .create(ownerId, createInput);
    const tripId = createResult.trip.id;

    const inviteeId = randomUUID();
    const inviteeUsername = `race-${inviteeId.slice(0, 8)}`;
    const inviteeEmail = `${inviteeId}@example.invalid`;
    userIds.push(inviteeId);

    await prisma.user.create({
      data: {
        id: inviteeId,
        email: inviteeEmail,
        username: inviteeUsername,
        passwordHash: 'test-placeholder',
      },
    });

    // Send both requests together, identifying the same user differently.
    const responses = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/trips/${tripId}/invitations`)
        .set('Cookie', ownerCookie)
        .send({ username: inviteeUsername }),
      request(app.getHttpServer())
        .post(`/api/trips/${tripId}/invitations`)
        .set('Cookie', ownerCookie)
        .send({ email: inviteeEmail }),
    ]);

    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([201, 409]);

    const conflictResponse = responses.find(
      (response) => response.status === 409,
    );

    expect(conflictResponse?.body).toEqual({
      error: {
        code: 'INVITATION_ALREADY_PENDING',
        message: 'Invitation is already pending',
        details: {},
      },
    });

    // The database must contain exactly one pending invitation.
    expect(
      await prisma.tripInvitation.count({
        where: { tripId, inviteeId, status: 'PENDING' },
      }),
    ).toBe(1);
  });

  // Reject bad input and attempts to supply a creator or role in the body.
  it('rejects invalid input and client-supplied identity or role', async () => {
    const tripCountBefore = await prisma.trip.count({
      where: { createdBy: ownerId },
    });
    const invalidInputs = [
      { ...createInput, title: '   ' },
      { ...createInput, startDate: '2026-02-30' },
      { ...createInput, startDate: '2026-11-05' },
      { ...createInput, createdBy: otherUserId },
      { ...createInput, role: 'OWNER' },
    ];

    for (const input of invalidInputs) {
      await request(app.getHttpServer())
        .post('/api/trips')
        .set('Cookie', ownerCookie)
        .send(input)
        .expect(400, {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request input',
            details: {},
          },
        });
    }

    expect(await prisma.trip.count({ where: { createdBy: ownerId } })).toBe(
      tripCountBefore,
    );
  });

  // Concurrent Accept requests must create exactly one Membership.
  it('serializes concurrent Accept requests for the same invitation', async () => {
    const createResult = await app
      .get(TripsService)
      .create(ownerId, createInput);
    const tripId = createResult.trip.id;

    const invitation = await prisma.tripInvitation.create({
      data: {
        tripId,
        invitedBy: ownerId,
        inviteeId: otherUserId,
        status: 'PENDING',
      },
    });

    const sendAccept = () =>
      request(app.getHttpServer())
        .post(`/api/invitations/${invitation.id}/accept`)
        .set('Cookie', otherCookie);

    const responses = await Promise.all([
      sendAccept(),
      sendAccept(),
    ]);

    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([201, 409]);

    const conflictResponse = responses.find(
      (response) => response.status === 409,
    );
    expect(conflictResponse?.body.error.code).toBe('INVITATION_NOT_PENDING');

    expect(
      await prisma.tripMember.count({
        where: { tripId, userId: otherUserId },
      }),
    ).toBe(1);

    const savedInvitation = await prisma.tripInvitation.findUnique({
      where: { id: invitation.id },
    });

    expect(savedInvitation).toMatchObject({
      status: 'ACCEPTED',
      inviteeId: otherUserId,
    });
    expect(savedInvitation?.respondedAt).toBeInstanceOf(Date);
  });

  // Roll back the Membership if updating the Invitation fails.
  it('rolls back Accept when the Invitation update fails', async () => {
    const createResult = await app
      .get(TripsService)
      .create(ownerId, createInput);
    const tripId = createResult.trip.id;

    const invitation = await prisma.tripInvitation.create({
      data: {
        tripId,
        invitedBy: ownerId,
        inviteeId: otherUserId,
        status: 'PENDING',
      },
    });

    const suffix = randomUUID().replace(/-/g, '');
    const functionName = `test_fail_accept_${suffix}`;
    const triggerName = `test_fail_accept_trigger_${suffix}`;

    try {
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION "${functionName}"()
        RETURNS trigger AS $$
        BEGIN
          IF NEW."status" = 'ACCEPTED' THEN
            RAISE EXCEPTION 'forced accept update failure';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "${triggerName}"
        BEFORE UPDATE ON "trip_invitation"
        FOR EACH ROW
        EXECUTE FUNCTION "${functionName}"();
      `);

      const response = await request(app.getHttpServer())
        .post(`/api/invitations/${invitation.id}/accept`)
        .set('Cookie', otherCookie);

      expect(response.status).toBe(500);

      // The Membership created earlier in the transaction must be rolled back.
      expect(
        await prisma.tripMember.count({
          where: { tripId, userId: otherUserId },
        }),
      ).toBe(0);

      // The Invitation must remain pending and unanswered.
      const savedInvitation = await prisma.tripInvitation.findUnique({
        where: { id: invitation.id },
      });

      expect(savedInvitation).toMatchObject({
        status: 'PENDING',
        respondedAt: null,
      });
    } finally {
      await prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS "${triggerName}" ON "trip_invitation";
      `);

      await prisma.$executeRawUnsafe(`
        DROP FUNCTION IF EXISTS "${functionName}"();
      `);
    }
  });

  // Accept must not create a duplicate Membership for a current Member.
  it('rejects Accept when the invitee is already a current Trip member', async () => {
    const createResult = await app
      .get(TripsService)
      .create(ownerId, createInput);
    const tripId = createResult.trip.id;

    await prisma.tripMember.create({
      data: {
        tripId,
        userId: otherUserId,
        role: 'MEMBER',
      },
    });

    const invitation = await prisma.tripInvitation.create({
      data: {
        tripId,
        invitedBy: ownerId,
        inviteeId: otherUserId,
        status: 'PENDING',
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/invitations/${invitation.id}/accept`)
      .set('Cookie', otherCookie)
      .expect(409);

    expect(response.body.error.code).toBe('MEMBERSHIP_ALREADY_EXISTS');

    expect(
      await prisma.tripMember.count({
        where: { tripId, userId: otherUserId },
      }),
    ).toBe(1);

    const savedInvitation = await prisma.tripInvitation.findUnique({
      where: { id: invitation.id },
    });

    expect(savedInvitation).toMatchObject({
      status: 'PENDING',
      respondedAt: null,
    });
  });

  // A failed Socket cleanup must roll back the Leave transaction.
  it('preserves Membership and Votes when Socket cleanup fails', async () => {
    const createResult = await app
      .get(TripsService)
      .create(ownerId, createInput);
    const tripId = createResult.trip.id;

    await prisma.tripMember.create({
      data: {
        tripId,
        userId: otherUserId,
        role: 'MEMBER',
      },
    });

    const proposal = await prisma.proposal.create({
      data: {
        tripId,
        createdBy: ownerId,
        title: 'Socket cleanup failure proposal',
      },
    });

    await prisma.proposalVote.create({
      data: {
        proposalId: proposal.id,
        userId: otherUserId,
        decision: 'AGREE',
      },
    });

    const cleanupSpy = vi
      .spyOn(realtime, 'removeUserFromTrip')
      .mockRejectedValueOnce(new Error('Simulated Socket cleanup failure'));

    try {
      const response = await request(app.getHttpServer())
        .post(`/api/trips/${tripId}/leave`)
        .set('Cookie', otherCookie)
        .expect(503);

      expect(response.body.error.code).toBe(
        'TRIP_SOCKET_CLEANUP_FAILED',
      );
      expect(cleanupSpy).toHaveBeenCalledWith(otherUserId, tripId);
    } finally {
      cleanupSpy.mockRestore();
    }

    // The transaction must roll back: Membership remains.
    expect(
      await prisma.tripMember.findUnique({
        where: {
          tripId_userId: {
            tripId,
            userId: otherUserId,
          },
        },
      }),
    ).not.toBeNull();

    // The transaction must also preserve the Member's Vote.
    expect(
      await prisma.proposalVote.count({
        where: {
          proposalId: proposal.id,
          userId: otherUserId,
        },
      }),
    ).toBe(1);
  });

  // A Member can leave safely; the Owner cannot leave.
  it('prevents Owner departure and removes a Member votes without deleting Proposals', async () => {
    const createResult = await app
      .get(TripsService)
      .create(ownerId, createInput);
    const tripId = createResult.trip.id;

    await prisma.tripMember.create({
      data: {
        tripId,
        userId: otherUserId,
        role: 'MEMBER',
      },
    });

    // The Owner must remain a member.
    const ownerLeaveResponse = await request(app.getHttpServer())
      .post(`/api/trips/${tripId}/leave`)
      .set('Cookie', ownerCookie)
      .expect(409);

    expect(ownerLeaveResponse.body.error.code).toBe('OWNER_CANNOT_LEAVE');

    const firstProposal = await prisma.proposal.create({
      data: {
        tripId,
        createdBy: ownerId,
        title: 'First proposal',
      },
    });

    const secondProposal = await prisma.proposal.create({
      data: {
        tripId,
        createdBy: ownerId,
        title: 'Second proposal',
      },
    });

    await prisma.proposalVote.createMany({
      data: [
        { proposalId: firstProposal.id, userId: ownerId, decision: 'AGREE' },
        { proposalId: firstProposal.id, userId: otherUserId, decision: 'REJECT' },
        { proposalId: secondProposal.id, userId: ownerId, decision: 'REJECT' },
        { proposalId: secondProposal.id, userId: otherUserId, decision: 'AGREE' },
      ],
    });

    // The Member leaves successfully.
    await request(app.getHttpServer())
      .post(`/api/trips/${tripId}/leave`)
      .set('Cookie', otherCookie)
      .expect(204);

    // Membership is removed.
    expect(
      await prisma.tripMember.findUnique({
        where: {
          tripId_userId: {
            tripId,
            userId: otherUserId,
          },
        },
      }),
    ).toBeNull();

    // All of this Member's votes in the Trip are removed.
    expect(
      await prisma.proposalVote.count({
        where: {
          userId: otherUserId,
          proposal: { tripId },
        },
      }),
    ).toBe(0);

    // The Owner's votes remain.
    expect(
      await prisma.proposalVote.count({
        where: {
          userId: ownerId,
          proposal: { tripId },
        },
      }),
    ).toBe(2);

    // Historical Proposals remain and their status is unchanged.
    const savedProposals = await prisma.proposal.findMany({
      where: { tripId },
      orderBy: { title: 'asc' },
    });

    expect(savedProposals).toHaveLength(2);
    expect(savedProposals.map((proposal) => proposal.status)).toEqual([
      'PENDING',
      'PENDING',
    ]);

    const tripNotFound = {
      error: {
        code: 'TRIP_NOT_FOUND',
        message: 'Trip not found',
        details: {},
      },
    };

    // The former Member immediately loses REST access.
    for (const route of [
      `/api/trips/${tripId}`,
      `/api/trips/${tripId}/members`,
      `/api/trips/${tripId}/days`,
    ]) {
      await request(app.getHttpServer())
        .get(route)
        .set('Cookie', otherCookie)
        .expect(404, tripNotFound);
    }

    const tripList = await request(app.getHttpServer())
      .get('/api/trips')
      .set('Cookie', otherCookie)
      .expect(200);

    expect(
      tripList.body.trips.some(
        (trip: { id: string }) => trip.id === tripId,
      ),
    ).toBe(false);
  });

  // Preserve the domain 404 response for authenticated non-members.
  it('hides trip details and days from a non-member through HTTP', async () => {
    const createResult = await app
      .get(TripsService)
      .create(ownerId, createInput);

    for (const path of [
    `/api/trips/${createResult.trip.id}`,
    `/api/trips/${createResult.trip.id}/days`,
    `/api/trips/${createResult.trip.id}/members`,
    ]) {
      await request(app.getHttpServer())
        .get(path)
        .set('Cookie', otherCookie)
        .expect(404, {
          error: {
            code: 'TRIP_NOT_FOUND',
            message: 'Trip not found',
            details: {},
          },
        });
    }
  });

  // Return 204 with no response body after owner deletion.
  it('returns 204 with no body after owner deletion', async () => {
    const createResult = await app
      .get(TripsService)
      .create(ownerId, createInput);

    const deleteResponse = await request(app.getHttpServer())
      .delete(`/api/trips/${createResult.trip.id}`)
      .set('Cookie', ownerCookie)
      .expect(204);

    expect(deleteResponse.text).toBe('');
  });

  // Reject member deletion and preserve the trip.
  it('returns 403 when an ordinary member deletes a trip', async () => {
    const createResult = await app
      .get(TripsService)
      .create(ownerId, createInput);
    const tripId = createResult.trip.id;

    await prisma.tripMember.create({
      data: {
        tripId: tripId,
        userId: otherUserId,
        role: 'MEMBER',
      },
    });

    await request(app.getHttpServer())
      .delete(`/api/trips/${tripId}`)
      .set('Cookie', otherCookie)
      .expect(403, {
        error: {
          code: 'TRIP_OWNER_REQUIRED',
          message: 'Trip owner required',
          details: {},
        },
      });

    const savedTrip = await prisma.trip.findUnique({
      where: {
        id: tripId,
      },
    });

    expect(savedTrip).not.toBeNull();
  });
});
