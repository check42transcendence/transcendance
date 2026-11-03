
import { randomUUID } from 'node:crypto';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { PrismaService } from '../../src/database/prisma.service.js';
import { ProposalsService } from '../../src/proposals/proposals.service.js';
import {
  closeTestDatabase,
  getTestDatabaseUrl,
  resetTestDatabase,
  testDatabase,
} from './test-database.js';

describe('ProposalsService database integration', () => {
  let prisma: PrismaService;
  let service: ProposalsService;

  let ownerId: string;
  let memberId: string;
  let outsiderId: string;
  let tripId: string;
  let otherTripId: string;

  const input = {
    title: 'Visit Louvre',
    description: 'Tuesday afternoon',
  };

  async function createUser(username: string) {
    return prisma.user.create({
      data: {
        email: `${username}@example.invalid`,
        username,
        passwordHash: 'test-placeholder',
      },
    });
  }

  async function createTrip(title: string) {
    return prisma.trip.create({
      data: {
        title,
        destination: 'Paris',
        startDate: new Date('2027-01-01T00:00:00.000Z'),
        endDate: new Date('2027-01-02T00:00:00.000Z'),
        createdBy: ownerId,
        members: {
          create: {
            userId: ownerId,
            role: 'OWNER',
          },
        },
      },
    });
  }

  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', getTestDatabaseUrl());

    prisma = new PrismaService();
    service = new ProposalsService(prisma);

    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetTestDatabase();

    ownerId = (await createUser('proposal-owner')).id;
    memberId = (await createUser('proposal-member')).id;
    outsiderId = (await createUser('proposal-outsider')).id;

    tripId = (await createTrip('Paris trip')).id;
    otherTripId = (await createTrip('Another trip')).id;

    await prisma.tripMember.create({
      data: {
        tripId,
        userId: memberId,
        role: 'MEMBER',
      },
    });
  });

  afterAll(async () => {
    try {
      await resetTestDatabase();
    } finally {
      try {
        await prisma.$disconnect();
        await closeTestDatabase();
      } finally {
        vi.unstubAllEnvs();
      }
    }
  });

  it('allows an OWNER to create a PENDING Proposal', async () => {
    const result = await service.create(ownerId, tripId, {
      title: 'Visit Louvre',
      description: null,
    });

    expect(result.proposal).toMatchObject({
      id: expect.any(String),
      tripId,
      title: 'Visit Louvre',
      description: null,
      status: 'PENDING',
      createdBy: {
        id: ownerId,
        username: 'proposal-owner',
      },
      createdAt: expect.any(String),
      voteSummary: {
        agreeCount: 0,
        rejectCount: 0,
        pendingCount: 2,
        participantCount: 2,
        requiredAgreeCount: 2,
        canAdopt: false,
      },
      currentUserDecision: null,
    });

    expect(await prisma.proposal.count({ where: { tripId } })).toBe(1);
  });

  it('allows a MEMBER to create a Proposal', async () => {
    const result = await service.create(memberId, tripId, input);

    expect(result.proposal).toMatchObject({
      title: input.title,
      description: input.description,
      status: 'PENDING',
      createdBy: {
        id: memberId,
        username: 'proposal-member',
      },
    });

    const saved = await prisma.proposal.findUniqueOrThrow({
      where: { id: result.proposal.id },
    });

    expect(saved.createdBy).toBe(memberId);
  });

  it('rejects creation by non-members and for missing Trips', async () => {
    for (const [userId, requestedTripId] of [
      [outsiderId, tripId],
      [ownerId, randomUUID()],
    ]) {
      await expect(
        service.create(userId, requestedTripId, input),
      ).rejects.toMatchObject({
        status: 404,
        response: {
          error: { code: 'TRIP_NOT_FOUND' },
        },
      });
    }

    expect(await prisma.proposal.count()).toBe(0);
  });

it('avoids deadlock when Trip deletion races with Proposal creation', async () => {
  const client = await testDatabase.connect();
  let transactionOpen = false;
  let pendingCreate: Promise<unknown> | undefined;

  try {
    await client.query('BEGIN');
    transactionOpen = true;

    // Simulate deletion acquiring the parent Trip lock first.
    await client.query(
      'SELECT id FROM "trip" WHERE id = $1::uuid FOR UPDATE',
      [tripId],
    );

    // Start Proposal creation on another database connection.
    const creation = service.create(memberId, tripId, input);
    pendingCreate = creation;

    // Attach a rejection handler while the other transaction is held.
    void creation.catch(() => undefined);

    // Wait until creation is blocked trying to lock the Trip.
    let waitingForTrip = false;
    const deadline = Date.now() + 3000;

    while (Date.now() < deadline) {
      const result = await testDatabase.query(
        `SELECT pid
         FROM pg_stat_activity
         WHERE datname = current_database()
           AND pid <> pg_backend_pid()
           AND wait_event_type = 'Lock'
           AND query LIKE '%FOR KEY SHARE%'`,
      );

      if (result.rows.length > 0) {
        waitingForTrip = true;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    expect(waitingForTrip).toBe(true);

    // Deletion should proceed without waiting on a Membership lock
    // held by the Proposal creation request.
    await client.query(
      'DELETE FROM "trip" WHERE id = $1::uuid',
      [tripId],
    );

    await client.query('COMMIT');
    transactionOpen = false;

    // After deletion, creation must fail without writing a Proposal.
    await expect(creation).rejects.toMatchObject({
      status: 404,
      response: {
        error: { code: 'TRIP_NOT_FOUND' },
      },
    });

    expect(
      await prisma.proposal.count({
        where: { tripId },
      }),
    ).toBe(0);
  } finally {
    if (transactionOpen) {
      await client.query('ROLLBACK');
    }

    client.release();

    if (pendingCreate) {
      await pendingCreate.catch(() => undefined);
    }
  }
});

  it('rejects creation after membership has been removed', async () => {
    await prisma.tripMember.delete({
      where: {
        tripId_userId: {
          tripId,
          userId: memberId,
        },
      },
    });

    await expect(
      service.create(memberId, tripId, input),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        error: { code: 'TRIP_NOT_FOUND' },
      },
    });

    expect(await prisma.proposal.count()).toBe(0);
  });

  it('lists only the requested Trip Proposals in newest-first order', async () => {
    const oldProposal = await prisma.proposal.create({
      data: {
        tripId,
        createdBy: ownerId,
        title: 'Old proposal',
        createdAt: new Date('2027-01-01T10:00:00.000Z'),
      },
    });

    const newProposal = await prisma.proposal.create({
      data: {
        tripId,
        createdBy: ownerId,
        title: 'New proposal',
        createdAt: new Date('2027-01-02T10:00:00.000Z'),
      },
    });

    await prisma.proposal.create({
      data: {
        tripId: otherTripId,
        createdBy: ownerId,
        title: 'Other Trip proposal',
      },
    });

    const result = await service.findAll(memberId, tripId);

    expect(result.proposals.map((proposal) => proposal.id)).toEqual([
      newProposal.id,
      oldProposal.id,
    ]);

    expect(result.proposals[0].voteSummary.participantCount).toBe(2);
  });

  it('calculates votes using only current Trip members', async () => {
    const created = await service.create(ownerId, tripId, input);
    const proposalId = created.proposal.id;

    await prisma.proposalVote.createMany({
      data: [
        { proposalId, userId: ownerId, decision: 'AGREE' },
        { proposalId, userId: memberId, decision: 'REJECT' },
        { proposalId, userId: outsiderId, decision: 'AGREE' },
      ],
    });

    const result = await service.findOne(memberId, tripId, proposalId);

    expect(result.proposal.voteSummary).toEqual({
      agreeCount: 1,
      rejectCount: 1,
      pendingCount: 0,
      participantCount: 2,
      requiredAgreeCount: 2,
      canAdopt: false,
    });

    expect(result.proposal.currentUserDecision).toBe('REJECT');

    const ownerResult = await service.findOne(
      ownerId,
      tripId,
      proposalId,
    );

    expect(ownerResult.proposal.currentUserDecision).toBe('AGREE');
  });

  it('calculates majority and prevents adoption of ACCEPTED Proposals', async () => {
    const created = await service.create(ownerId, tripId, input);
    const proposalId = created.proposal.id;

    await prisma.proposalVote.createMany({
      data: [
        { proposalId, userId: ownerId, decision: 'AGREE' },
        { proposalId, userId: memberId, decision: 'AGREE' },
      ],
    });

    const pending = await service.findOne(ownerId, tripId, proposalId);

    expect(pending.proposal.voteSummary.canAdopt).toBe(true);

    await prisma.proposal.update({
      where: { id: proposalId },
      data: { status: 'ACCEPTED' },
    });

    const accepted = await service.findOne(ownerId, tripId, proposalId);

    expect(accepted.proposal.status).toBe('ACCEPTED');
    expect(accepted.proposal.voteSummary.canAdopt).toBe(false);
  });

  it('rejects missing Proposals and cross-Trip Proposal IDs', async () => {
    const otherProposal = await prisma.proposal.create({
      data: {
        tripId: otherTripId,
        createdBy: ownerId,
        title: 'Private proposal',
      },
    });

    for (const proposalId of [randomUUID(), otherProposal.id]) {
      await expect(
        service.findOne(ownerId, tripId, proposalId),
      ).rejects.toMatchObject({
        status: 404,
        response: {
          error: { code: 'PROPOSAL_NOT_FOUND' },
        },
      });
    }
  });

  it('hides lists and details from non-members', async () => {
    const created = await service.create(ownerId, tripId, input);

    await expect(
      service.findAll(outsiderId, tripId),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        error: { code: 'TRIP_NOT_FOUND' },
      },
    });

    await expect(
      service.findOne(outsiderId, tripId, created.proposal.id),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        error: { code: 'TRIP_NOT_FOUND' },
      },
    });
  });
});
