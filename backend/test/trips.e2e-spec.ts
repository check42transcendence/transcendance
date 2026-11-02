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
