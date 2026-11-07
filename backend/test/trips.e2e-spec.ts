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
import { TripsService } from '../src/trips/trips.service.js';

// Exercise HTTP validation, identity, and responses against a real test database.
describe('Trip HTTP integration', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
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
