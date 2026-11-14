
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';

import { io, type Socket } from 'socket.io-client';

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  RealtimeEnvelope,
  SubscriptionAck,
} from '@tripcollab/shared';

import { assertTestDatabaseUrl } from '../scripts/test-database-url.mjs';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { TripGateway } from '../src/realtime/trip.gateway.js';
import { RealtimeService } from '../src/realtime/realtime.service.js';

describe('Realtime Gateway (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let gateway: TripGateway;
  let realtime: RealtimeService;
  let serverUrl: string;

  const clients: Socket[] = [];
  const createdTripIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    // Refuse to run against an unsafe database.
    assertTestDatabaseUrl('DATABASE_URL');

    vi.stubEnv(
      'JWT_SECRET',
      'local-realtime-e2e-test-secret',
    );

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

	app.use(cookieParser());
	app.setGlobalPrefix('api');

    await app.init();
    await app.listen(0);

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    gateway = app.get(TripGateway);
    realtime = app.get(RealtimeService);

    const address = app.getHttpServer().address() as AddressInfo;

    serverUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    // Close all test connections first.
    for (const client of clients.splice(0)) {
      client.disconnect();
    }

    // Deleting a Trip cascades its memberships/invitations.
    for (const tripId of createdTripIds.splice(0).reverse()) {
      await prisma.trip.deleteMany({
        where: { id: tripId },
      });
    }

    for (const userId of createdUserIds.splice(0).reverse()) {
      await prisma.user.deleteMany({
        where: { id: userId },
      });
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    vi.unstubAllEnvs();
  });

  function createClient(cookie?: string): Socket {
    const client = io(serverUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false,
      timeout: 3000,
      extraHeaders: cookie
        ? { Cookie: cookie }
        : undefined,
    });

    clients.push(client);
    return client;
  }

  function waitForConnect(client: Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Socket connection timed out'));
      }, 3000);

      function cleanup() {
        clearTimeout(timeout);
        client.off('connect', onConnect);
        client.off('connect_error', onError);
      }

      function onConnect() {
        cleanup();
        resolve();
      }

      function onError(error: Error) {
        cleanup();
        reject(error);
      }

      client.once('connect', onConnect);
      client.once('connect_error', onError);
      client.connect();
    });
  }

  function waitForConnectError(client: Socket): Promise<Error> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Expected authentication rejection'));
      }, 3000);

      function cleanup() {
        clearTimeout(timeout);
        client.off('connect', onConnect);
        client.off('connect_error', onError);
      }

      function onConnect() {
        cleanup();
        reject(new Error('Unexpected successful connection'));
      }

      function onError(error: Error) {
        cleanup();
        resolve(error);
      }

      client.once('connect', onConnect);
      client.once('connect_error', onError);
      client.connect();
    });
  }

  async function connectAs(userId: string): Promise<Socket> {
    const token = jwtService.sign({
      sub: userId,
    });

    const client = createClient(`token=${token}`);

    await waitForConnect(client);
    return client;
  }

  async function sendTripEvent(
    client: Socket,
    eventName: 'trip:subscribe' | 'trip:unsubscribe',
    tripId: string,
  ): Promise<SubscriptionAck> {
    return client
      .timeout(2000)
      .emitWithAck(eventName, { tripId });
  }

  function isInTripRoom(
    client: Socket,
    tripId: string,
  ): boolean {
    if (!client.id) {
      return false;
    }

    const room = gateway.server.sockets.adapter.rooms.get(
      `trip:${tripId}`,
    );

    return room?.has(client.id) ?? false;
  }

  async function createTestUser() {
    const unique = randomUUID().replaceAll('-', '');

    const user = await prisma.user.create({
      data: {
        email: `realtime-${unique}@example.test`,
        username: `rt_${unique.slice(0, 20)}`,
        passwordHash: 'not-a-real-password-hash',
      },
    });

    createdUserIds.push(user.id);
    return user;
  }

  async function createTestTrip(ownerId: string) {
    const trip = await prisma.trip.create({
      data: {
        title: 'Realtime E2E Trip',
        destination: 'Paris',
        description: 'Temporary realtime test trip',
        startDate: new Date('2027-01-10T00:00:00.000Z'),
        endDate: new Date('2027-01-15T00:00:00.000Z'),
        createdBy: ownerId,
        members: {
          create: {
            userId: ownerId,
            role: 'OWNER',
          },
        },
      },
    });

    createdTripIds.push(trip.id);
    return trip;
  }

  async function addMember(
    tripId: string,
    userId: string,
  ) {
    return prisma.tripMember.create({
      data: {
        tripId,
        userId,
        role: 'MEMBER',
      },
    });
  }

  async function removeMember(
    tripId: string,
    userId: string,
  ): Promise<void> {
    await prisma.tripMember.delete({
      where: {
        tripId_userId: {
          tripId,
          userId,
        },
      },
    });
  }

  // ------------------------------------------------------------------
  // Authentication
  // ------------------------------------------------------------------

  describe('authentication', () => {
    it('rejects a socket without a cookie', async () => {
      const client = createClient();

      const error = await waitForConnectError(client);

      expect(error.message).toContain('Authentication');
      expect(client.connected).toBe(false);
    });

    it('rejects an invalid JWT', async () => {
      const client = createClient('token=invalid-jwt');

      const error = await waitForConnectError(client);

      expect(error.message).toContain('Authentication');
      expect(client.connected).toBe(false);
    });

    it('rejects a JWT without a valid subject', async () => {
      const token = jwtService.sign({
        sub: 'not-a-uuid',
      });

      const client = createClient(`token=${token}`);

      const error = await waitForConnectError(client);

      expect(error.message).toContain('Authentication');
    });

    it('accepts a valid JWT identity', async () => {
      const client = await connectAs(randomUUID());

      expect(client.connected).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // Subscribe
  // ------------------------------------------------------------------

  describe('trip:subscribe', () => {
    it('allows OWNER to join the Trip Room', async () => {
      const owner = await createTestUser();
      const trip = await createTestTrip(owner.id);
      const client = await connectAs(owner.id);

      const ack = await sendTripEvent(
        client,
        'trip:subscribe',
        trip.id,
      );

      expect(ack).toEqual({ ok: true });
      expect(isInTripRoom(client, trip.id)).toBe(true);
    });

    it('allows MEMBER to join the Trip Room', async () => {
      const owner = await createTestUser();
      const member = await createTestUser();
      const trip = await createTestTrip(owner.id);

      await addMember(trip.id, member.id);

      const client = await connectAs(member.id);

      const ack = await sendTripEvent(
        client,
        'trip:subscribe',
        trip.id,
      );

      expect(ack).toEqual({ ok: true });
      expect(isInTripRoom(client, trip.id)).toBe(true);
    });

    it('rejects a non-member', async () => {
      const owner = await createTestUser();
      const outsider = await createTestUser();
      const trip = await createTestTrip(owner.id);

      const client = await connectAs(outsider.id);

      const ack = await sendTripEvent(
        client,
        'trip:subscribe',
        trip.id,
      );

      expect(ack).toEqual({ ok: false });
      expect(isInTripRoom(client, trip.id)).toBe(false);
    });

    it('rejects a user with only a PENDING invitation', async () => {
      const owner = await createTestUser();
      const invitee = await createTestUser();
      const trip = await createTestTrip(owner.id);

      await prisma.tripInvitation.create({
        data: {
          tripId: trip.id,
          invitedBy: owner.id,
          inviteeId: invitee.id,
          status: 'PENDING',
        },
      });

      const client = await connectAs(invitee.id);

      const ack = await sendTripEvent(
        client,
        'trip:subscribe',
        trip.id,
      );

      expect(ack).toEqual({ ok: false });
      expect(isInTripRoom(client, trip.id)).toBe(false);
    });

    it('rejects an invalid tripId', async () => {
      const owner = await createTestUser();
      const client = await connectAs(owner.id);

      const ack = await sendTripEvent(
        client,
        'trip:subscribe',
        'invalid-trip-id',
      );

      expect(ack).toEqual({ ok: false });
    });

    it('rechecks Membership on every subscribe', async () => {
      const owner = await createTestUser();
      const member = await createTestUser();
      const trip = await createTestTrip(owner.id);

      await addMember(trip.id, member.id);

      const client = await connectAs(member.id);

      expect(
        await sendTripEvent(
          client,
          'trip:subscribe',
          trip.id,
        ),
      ).toEqual({ ok: true });

      // Leave the room before changing Membership.
      await sendTripEvent(
        client,
        'trip:unsubscribe',
        trip.id,
      );

      await removeMember(trip.id, member.id);

      expect(
        await sendTripEvent(
          client,
          'trip:subscribe',
          trip.id,
        ),
      ).toEqual({ ok: false });

      expect(isInTripRoom(client, trip.id)).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // Unsubscribe
  // ------------------------------------------------------------------

  describe('trip:unsubscribe', () => {
    it('rejects an invalid tripId', async () => {
      const owner = await createTestUser();
      const client = await connectAs(owner.id);

      const ack = await sendTripEvent(
        client,
        'trip:unsubscribe',
        'invalid-trip-id',
      );

      expect(ack).toEqual({ ok: false });
    });

    it('leaves the Room without deleting Membership', async () => {
      const owner = await createTestUser();
      const trip = await createTestTrip(owner.id);
      const client = await connectAs(owner.id);

      await sendTripEvent(
        client,
        'trip:subscribe',
        trip.id,
      );

      const ack = await sendTripEvent(
        client,
        'trip:unsubscribe',
        trip.id,
      );

      expect(ack).toEqual({ ok: true });
      expect(isInTripRoom(client, trip.id)).toBe(false);

      const membership = await prisma.tripMember.findUnique({
        where: {
          tripId_userId: {
            tripId: trip.id,
            userId: owner.id,
          },
        },
      });

      expect(membership).not.toBeNull();
      expect(membership?.role).toBe('OWNER');
    });

    it('removes only the current socket from the Room', async () => {
      const owner = await createTestUser();
      const trip = await createTestTrip(owner.id);

      const socketA = await connectAs(owner.id);
      const socketB = await connectAs(owner.id);

      await sendTripEvent(
        socketA,
        'trip:subscribe',
        trip.id,
      );

      await sendTripEvent(
        socketB,
        'trip:subscribe',
        trip.id,
      );

      const ack = await sendTripEvent(
        socketA,
        'trip:unsubscribe',
        trip.id,
      );

      expect(ack).toEqual({ ok: true });
      expect(isInTripRoom(socketA, trip.id)).toBe(false);
      expect(isInTripRoom(socketB, trip.id)).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // Shared server interfaces
  // ------------------------------------------------------------------

  describe('RealtimeService', () => {
    it('serializes a concurrent Subscribe with HTTP Leave', async () => {
      const owner = await createTestUser();
      const member = await createTestUser();
      const trip = await createTestTrip(owner.id);

      await addMember(trip.id, member.id);

      const memberSocket = await connectAs(member.id);
      const ownerSocket = await connectAs(owner.id);

      await sendTripEvent(ownerSocket, 'trip:subscribe', trip.id);

      const serverSocket = gateway.server.sockets.sockets.get(memberSocket.id!);

      if (!serverSocket) {
        throw new Error('Member server socket was not found');
      }

      // Pause Socket joining after the subscription has acquired FOR SHARE.
      const originalJoin = serverSocket.join.bind(serverSocket);

      let signalJoinStarted!: () => void;
      const joinStarted = new Promise<void>((resolve) => {
        signalJoinStarted = resolve;
      });

      let releaseJoin!: () => void;
      const joinGate = new Promise<void>((resolve) => {
        releaseJoin = resolve;
      });

      let subscribePromise: Promise<SubscriptionAck> | undefined;
      let leavePromise: Promise<unknown> | undefined;

      serverSocket.join = async (rooms) => {
        signalJoinStarted();
        await joinGate;
        await originalJoin(rooms);
      };

      try {
        subscribePromise = sendTripEvent(
          memberSocket,
          'trip:subscribe',
          trip.id,
        );

        // This signal occurs inside joinIfCurrentMember's transaction.
        await joinStarted;

        // Start a real HTTP Leave while Subscribe holds FOR SHARE.
        leavePromise = request(app.getHttpServer())
          .post(`/api/trips/${trip.id}/leave`)
          .set('Cookie', `token=${jwtService.sign({ sub: member.id })}`)
          .then((response) => response);

        // Verify that Leave is actually blocked on the Trip row lock.
        let leaveIsBlocked = false;

        for (let attempt = 0; attempt < 200; attempt += 1) {
          const [state] = await prisma.$queryRaw<Array<{ waiting: boolean }>>`
            SELECT EXISTS (
              SELECT 1
              FROM pg_stat_activity
              WHERE datname = current_database()
                AND pid <> pg_backend_pid()
                AND wait_event_type = 'Lock'
                AND query ILIKE '%FOR UPDATE%'
                AND query ILIKE '%trip%'
            ) AS waiting
          `;

          if (state?.waiting) {
            leaveIsBlocked = true;
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        expect(leaveIsBlocked).toBe(true);

        // Finish Subscribe; Leave can now acquire FOR UPDATE and commit.
        releaseJoin();

        expect(await subscribePromise).toEqual({ ok: true });

        const leaveResponse = (await leavePromise) as { status: number };
        expect(leaveResponse.status).toBe(204);
      } finally {
        // Always release the test gate, even when an assertion fails.
        releaseJoin();
        serverSocket.join = originalJoin;

        const pending = [
          ...(subscribePromise ? [subscribePromise] : []),
          ...(leavePromise ? [leavePromise] : []),
        ];

        await Promise.allSettled(pending);
      }

      // Once Leave completes, the former Member must no longer be subscribed.
      expect(isInTripRoom(memberSocket, trip.id)).toBe(false);

      expect(
        await prisma.tripMember.findUnique({
          where: {
            tripId_userId: {
              tripId: trip.id,
              userId: member.id,
            },
          },
        }),
      ).toBeNull();

      // The current Owner remains authorized to receive Trip broadcasts.
      const ownerReceived = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Owner did not receive the Trip broadcast'));
        }, 2000);

        ownerSocket.once('activity:deleted', () => {
          clearTimeout(timer);
          resolve();
        });
      });

      await realtime.emitActivityToTrip(trip.id, 'activity:deleted', {
        activityId: randomUUID(),
        reopenedProposalId: null,
      });

      await ownerReceived;
    });


    it('rejects a concurrent Subscribe queued behind HTTP Leave', async () => {
      const owner = await createTestUser();
      const member = await createTestUser();
      const trip = await createTestTrip(owner.id);

      await addMember(trip.id, member.id);

      const memberSocket = await connectAs(member.id);

      let lockBackendPid = 0;
      let signalLockAcquired!: () => void;
      const lockAcquired = new Promise<void>((resolve) => {
        signalLockAcquired = resolve;
      });

      let releaseTripLock!: () => void;
      const tripLockReleased = new Promise<void>((resolve) => {
        releaseTripLock = resolve;
      });

      // Hold the Trip row lock so Leave can be queued before Subscribe.
      const lockTransaction = prisma.$transaction(async (tx) => {
        const [backend] = await tx.$queryRaw<Array<{ pid: number }>>`
          SELECT pg_backend_pid() AS pid
        `;
        lockBackendPid = backend.pid;

        await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "trip"
          WHERE "id" = ${trip.id}::uuid
          FOR UPDATE
        `;

        signalLockAcquired();
        await tripLockReleased;
      });

      await lockAcquired;

      let leavePromise: Promise<{ status: number }> | undefined;
      let subscribePromise: Promise<SubscriptionAck> | undefined;

      const waitForBlockedQuery = async (
        lockClause: 'FOR UPDATE' | 'FOR SHARE',
      ): Promise<void> => {
        for (let attempt = 0; attempt < 500; attempt += 1) {
          const [state] = await prisma.$queryRaw<
            Array<{ waiting: boolean }>
          >`
            SELECT EXISTS (
              SELECT 1
              FROM pg_stat_activity
              WHERE datname = current_database()
                AND pid <> ${lockBackendPid}
                AND wait_event_type = 'Lock'
                AND query ILIKE ${`%${lockClause}%`}
                AND query ILIKE '%trip%'
            ) AS waiting
          `;

          if (state?.waiting) {
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        throw new Error(`Timed out waiting for ${lockClause} to block`);
      };

      try {
        // Queue Leave first.
        leavePromise = request(app.getHttpServer())
          .post(`/api/trips/${trip.id}/leave`)
          .set(
            'Cookie',
            `token=${jwtService.sign({ sub: member.id })}`,
          )
          .then((response) => ({ status: response.status }));

        await waitForBlockedQuery('FOR UPDATE');

        // Queue Subscribe behind the waiting Leave request.
        subscribePromise = memberSocket
          .timeout(10000)
          .emitWithAck('trip:subscribe', { tripId: trip.id });

        await waitForBlockedQuery('FOR SHARE');
      } finally {
        // Release the blocker so Leave and Subscribe can finish.
        releaseTripLock();
        await lockTransaction;

        const pending = [
          ...(leavePromise ? [leavePromise] : []),
          ...(subscribePromise ? [subscribePromise] : []),
        ];

        await Promise.allSettled(pending);
      }

      if (!leavePromise || !subscribePromise) {
        throw new Error('Concurrent Leave/Subscribe requests were not started');
      }

      const [leaveResponse, subscribeAck] = await Promise.all([
        leavePromise,
        subscribePromise,
      ]);

      expect(leaveResponse.status).toBe(204);
      expect(subscribeAck).toEqual({ ok: false });

      expect(isInTripRoom(memberSocket, trip.id)).toBe(false);

      expect(
        await prisma.tripMember.findUnique({
          where: {
            tripId_userId: {
              tripId: trip.id,
              userId: member.id,
            },
          },
        }),
      ).toBeNull();
    });

    it('does not broadcast to a stale Room socket after Membership deletion', async () => {
      const owner = await createTestUser();
      const member = await createTestUser();
      const trip = await createTestTrip(owner.id);

      await addMember(trip.id, member.id);

      const ownerSocket = await connectAs(owner.id);
      const memberSocket = await connectAs(member.id);

      await sendTripEvent(ownerSocket, 'trip:subscribe', trip.id);
      await sendTripEvent(memberSocket, 'trip:subscribe', trip.id);

      expect(isInTripRoom(memberSocket, trip.id)).toBe(true);

      // Simulate a failed physical Socket eviction:
      // Membership is deleted, but the socket remains in the Room.
      await removeMember(trip.id, member.id);

      expect(isInTripRoom(memberSocket, trip.id)).toBe(true);

      const ownerEvents: unknown[] = [];
      const memberEvents: unknown[] = [];

      ownerSocket.on('activity:deleted', (event: unknown) => {
        ownerEvents.push(event);
      });

      memberSocket.on('activity:deleted', (event: unknown) => {
        memberEvents.push(event);
      });

      const ownerReceived = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('Owner did not receive the Trip broadcast'));
        }, 2000);

        ownerSocket.once('activity:deleted', () => {
          clearTimeout(timer);
          resolve();
        });
      });

      await realtime.emitActivityToTrip(trip.id, 'activity:deleted', {
        activityId: randomUUID(),
        reopenedProposalId: null,
      });

      await ownerReceived;
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(ownerEvents).toHaveLength(1);

      // The stale socket remains physically subscribed but receives no event.
      expect(isInTripRoom(memberSocket, trip.id)).toBe(true);
      expect(memberEvents).toHaveLength(0);
    });

    it('broadcasts only to subscribed Trip sockets', async () => {
      const owner = await createTestUser();
      const member = await createTestUser();
      const outsider = await createTestUser();

      const trip = await createTestTrip(owner.id);

      await addMember(trip.id, member.id);

      const ownerSocket = await connectAs(owner.id);
      const memberSocket = await connectAs(member.id);
      const outsiderSocket = await connectAs(outsider.id);

      await sendTripEvent(
        ownerSocket,
        'trip:subscribe',
        trip.id,
      );

      await sendTripEvent(
        memberSocket,
        'trip:subscribe',
        trip.id,
      );

      const ownerEvents: unknown[] = [];
      const memberEvents: unknown[] = [];
      const outsiderEvents: unknown[] = [];

      ownerSocket.on('activity:deleted', (event: unknown) => {
        ownerEvents.push(event);
      });

      memberSocket.on('activity:deleted', (event: unknown) => {
        memberEvents.push(event);
      });

      outsiderSocket.on('activity:deleted', (event: unknown) => {
        outsiderEvents.push(event);
      });

      const activityId = randomUUID();

      const received = Promise.all([
        new Promise<void>((resolve) => {
          ownerSocket.once('activity:deleted', () => resolve());
        }),
        new Promise<void>((resolve) => {
          memberSocket.once('activity:deleted', () => resolve());
        }),
      ]);

      await realtime.emitActivityToTrip(
        trip.id,
        'activity:deleted',
        {
          activityId,
          reopenedProposalId: null,
        },
      );

      await received;

      expect(ownerEvents).toHaveLength(1);
      expect(memberEvents).toHaveLength(1);
      expect(outsiderEvents).toHaveLength(0);

      const event = ownerEvents[0] as RealtimeEnvelope<{
        activityId: string;
        reopenedProposalId: string | null;
      }>;

      expect(event.tripId).toBe(trip.id);
      expect(event.data).toEqual({
        activityId,
        reopenedProposalId: null,
      });

      expect(
        Number.isNaN(Date.parse(event.occurredAt)),
      ).toBe(false);
    });

    it('removes all sockets belonging to one user', async () => {
      const owner = await createTestUser();
      const member = await createTestUser();
      const trip = await createTestTrip(owner.id);

      await addMember(trip.id, member.id);

      const socketA = await connectAs(member.id);
      const socketB = await connectAs(member.id);
      const ownerSocket = await connectAs(owner.id);

      await sendTripEvent(
        socketA,
        'trip:subscribe',
        trip.id,
      );

      await sendTripEvent(
        socketB,
        'trip:subscribe',
        trip.id,
      );

      await sendTripEvent(
        ownerSocket,
        'trip:subscribe',
        trip.id,
      );

      // Simulate successful Membership deletion.
      await removeMember(trip.id, member.id);

      // The integration hook called after commit.
      await realtime.removeUserFromTrip(
        member.id,
        trip.id,
      );

      expect(isInTripRoom(socketA, trip.id)).toBe(false);
      expect(isInTripRoom(socketB, trip.id)).toBe(false);
      expect(isInTripRoom(ownerSocket, trip.id)).toBe(true);

      // Leaving a Trip must not disconnect the user entirely.
      expect(socketA.connected).toBe(true);
      expect(socketB.connected).toBe(true);
    });

    it('preserves subscriptions to other Trips', async () => {
      const owner = await createTestUser();
      const member = await createTestUser();

      const tripA = await createTestTrip(owner.id);
      const tripB = await createTestTrip(owner.id);

      await addMember(tripA.id, member.id);
      await addMember(tripB.id, member.id);

      const client = await connectAs(member.id);

      await sendTripEvent(
        client,
        'trip:subscribe',
        tripA.id,
      );

      await sendTripEvent(
        client,
        'trip:subscribe',
        tripB.id,
      );

      await removeMember(tripA.id, member.id);

      await realtime.removeUserFromTrip(
        member.id,
        tripA.id,
      );

      expect(isInTripRoom(client, tripA.id)).toBe(false);
      expect(isInTripRoom(client, tripB.id)).toBe(true);
    });

    it('removes every socket from a deleted Trip Room', async () => {
      const owner = await createTestUser();
      const member = await createTestUser();
      const trip = await createTestTrip(owner.id);

      await addMember(trip.id, member.id);

      const ownerSocket = await connectAs(owner.id);
      const memberSocket = await connectAs(member.id);

      await sendTripEvent(
        ownerSocket,
        'trip:subscribe',
        trip.id,
      );

      await sendTripEvent(
        memberSocket,
        'trip:subscribe',
        trip.id,
      );

      // Simulate successful Trip deletion.
      await prisma.trip.delete({
        where: { id: trip.id },
      });

      // The integration hook called after commit.
      await realtime.removeTripRoom(trip.id);

      expect(isInTripRoom(ownerSocket, trip.id)).toBe(false);
      expect(isInTripRoom(memberSocket, trip.id)).toBe(false);

      expect(ownerSocket.connected).toBe(true);
      expect(memberSocket.connected).toBe(true);
    });

    it('rejects resubscription after Membership deletion', async () => {
      const owner = await createTestUser();
      const member = await createTestUser();
      const trip = await createTestTrip(owner.id);

      await addMember(trip.id, member.id);

      const client = await connectAs(member.id);

      await sendTripEvent(
        client,
        'trip:subscribe',
        trip.id,
      );

      await removeMember(trip.id, member.id);

      await realtime.removeUserFromTrip(
        member.id,
        trip.id,
      );

      const ack = await sendTripEvent(
        client,
        'trip:subscribe',
        trip.id,
      );

      expect(ack).toEqual({ ok: false });
      expect(isInTripRoom(client, trip.id)).toBe(false);
    });

    it('rejects resubscription after Trip deletion', async () => {
      const owner = await createTestUser();
      const trip = await createTestTrip(owner.id);
      const client = await connectAs(owner.id);

      await sendTripEvent(
        client,
        'trip:subscribe',
        trip.id,
      );

      await prisma.trip.delete({
        where: { id: trip.id },
      });

      await realtime.removeTripRoom(trip.id);

      const ack = await sendTripEvent(
        client,
        'trip:subscribe',
        trip.id,
      );

      expect(ack).toEqual({ ok: false });
      expect(isInTripRoom(client, trip.id)).toBe(false);
    });

  it('removes all Member sockets after real HTTP Leave', async () => {
    const owner = await createTestUser();
    const member = await createTestUser();
    const trip = await createTestTrip(owner.id);
    await addMember(trip.id, member.id);

    const ownerSocket = await connectAs(owner.id);
    const memberSocket1 = await connectAs(member.id);
    const memberSocket2 = await connectAs(member.id);

    // Owner and both Member sockets subscribe to the same Trip.
    for (const socket of [ownerSocket, memberSocket1, memberSocket2]) {
      expect(
        await sendTripEvent(socket, 'trip:subscribe', trip.id),
      ).toEqual({ ok: true });
      expect(isInTripRoom(socket, trip.id)).toBe(true);
    }

    // The Member leaves through the real HTTP API.
    const token = jwtService.sign({ sub: member.id });
    await request(app.getHttpServer())
      .post(`/api/trips/${trip.id}/leave`)
      .set('Cookie', `token=${token}`)
      .expect(204);

    // Membership is removed from the database.
    expect(
      await prisma.tripMember.findUnique({
        where: {
          tripId_userId: {
            tripId: trip.id,
            userId: member.id,
          },
        },
      }),
    ).toBeNull();

    // Owner remains subscribed; both Member sockets are evicted.
    expect(isInTripRoom(ownerSocket, trip.id)).toBe(true);

    for (const socket of [memberSocket1, memberSocket2]) {
      expect(socket.connected).toBe(true);
      expect(isInTripRoom(socket, trip.id)).toBe(false);

      // A departed Member cannot subscribe again.
      expect(
        await sendTripEvent(socket, 'trip:subscribe', trip.id),
      ).toEqual({ ok: false });
    }
  });

	it('removes all sockets after real HTTP Trip deletion', async () => {
		const owner = await createTestUser();
		const member = await createTestUser();
		const trip = await createTestTrip(owner.id);

		await addMember(trip.id, member.id);

		const ownerSocket = await connectAs(owner.id);
		const memberSocket1 = await connectAs(member.id);
		const memberSocket2 = await connectAs(member.id);

		const sockets = [ownerSocket, memberSocket1, memberSocket2];

		// All sockets subscribe to the same Trip.
		for (const socket of sockets) {
			expect(
			await sendTripEvent(socket, 'trip:subscribe', trip.id),
			).toEqual({ ok: true });
		}

		// Verify subscriptions exist before deletion.
		for (const socket of sockets) {
			expect(isInTripRoom(socket, trip.id)).toBe(true);
		}

		// Authenticate the real HTTP DELETE request.
		const token = jwtService.sign({ sub: owner.id });

		await request(app.getHttpServer())
			.delete(`/api/trips/${trip.id}`)
			.set('Cookie', `token=${token}`)
			.expect(204);

		// Verify database deletion.
		expect(
			await prisma.trip.findUnique({
			where: { id: trip.id },
			}),
		).toBeNull();

		// Verify all subscriptions were revoked.
		for (const socket of sockets) {
			expect(isInTripRoom(socket, trip.id)).toBe(false);
			expect(socket.connected).toBe(true);

			// Deleted Trip cannot be subscribed to again.
			expect(
			await sendTripEvent(socket, 'trip:subscribe', trip.id),
			).toEqual({ ok: false });
		}
	});
  });
});
