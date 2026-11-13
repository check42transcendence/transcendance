import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { ProposalsService } from '../src/proposals/proposals.service.js';

describe('Proposal HTTP integration', () => {
  let app: INestApplication<App>;
  let cookie: string;

  const userId = randomUUID();
  const tripId = randomUUID();
  const proposalId = randomUUID();

  const basePath = `/api/trips/${tripId}/proposals`;

  const mockService = {
    create: vi.fn(async () => ({
      proposal: { id: proposalId },
    })),
    findAll: vi.fn(async () => ({
      proposals: [],
    })),
    findOne: vi.fn(async () => ({
      proposal: { id: proposalId },
    })),
    vote: vi.fn(async () => ({
      proposal: {
        id: proposalId,
        currentUserDecision: 'AGREE',
      },
    })),
  };

  const authError = {
    error: {
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required',
      details: {},
    },
  };

  const validationError = {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request input',
      details: {},
    },
  };

  beforeAll(async () => {
    vi.stubEnv('JWT_SECRET', 'local-proposal-http-test-secret');

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ProposalsService)
      .useValue(mockService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.init();

    const jwtService = moduleFixture.get(JwtService);
    cookie = `token=${await jwtService.signAsync({ sub: userId })}`;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('requires authentication for all Proposal endpoints', async () => {
    await request(app.getHttpServer())
      .post(basePath)
      .send({ title: 'Visit Louvre' })
      .expect(401, authError);

    await request(app.getHttpServer()).get(basePath).expect(401, authError);

    await request(app.getHttpServer())
      .get(`${basePath}/${proposalId}`)
      .expect(401, authError);
    
      await request(app.getHttpServer())
      .put(`${basePath}/${proposalId}/vote`)
      .send({ decision: 'AGREE' })
      .expect(401, authError);

    expect(mockService.create).not.toHaveBeenCalled();
    expect(mockService.findAll).not.toHaveBeenCalled();
    expect(mockService.findOne).not.toHaveBeenCalled();
    expect(mockService.vote).not.toHaveBeenCalled();
  });

  it('creates a Proposal with validated and trimmed input', async () => {
    await request(app.getHttpServer())
      .post(basePath)
      .set('Cookie', cookie)
      .send({
        title: '  Visit Louvre  ',
        description: null,
      })
      .expect(201, {
        proposal: { id: proposalId },
      });

    expect(mockService.create).toHaveBeenCalledWith(
      userId,
      tripId,
      expect.objectContaining({
        title: 'Visit Louvre',
        description: null,
      }),
    );
  });

  it('rejects invalid titles, descriptions, and extra fields', async () => {
    const invalidInputs = [
      { title: '   ' },
      { title: 'x'.repeat(161) },
      { title: 'Visit Louvre', description: 123 },
      { title: 'Visit Louvre', status: 'ACCEPTED' },
      { title: 'Visit Louvre', createdBy: randomUUID() },
      { title: 'Visit Louvre', tripId },
    ];

    for (const input of invalidInputs) {
      await request(app.getHttpServer())
        .post(basePath)
        .set('Cookie', cookie)
        .send(input)
        .expect(400, validationError);
    }

    expect(mockService.create).not.toHaveBeenCalled();
  });

  it('rejects malformed Trip and Proposal UUIDs', async () => {
    await request(app.getHttpServer())
      .post('/api/trips/not-a-uuid/proposals')
      .set('Cookie', cookie)
      .send({ title: 'Visit Louvre' })
      .expect(400, validationError);

    await request(app.getHttpServer())
      .get(`${basePath}/not-a-uuid`)
      .set('Cookie', cookie)
      .expect(400, validationError);

    expect(mockService.create).not.toHaveBeenCalled();
    expect(mockService.findOne).not.toHaveBeenCalled();
  });

  it('routes Proposal list and detail requests to the Service', async () => {
    await request(app.getHttpServer())
      .get(basePath)
      .set('Cookie', cookie)
      .expect(200, { proposals: [] });

    expect(mockService.findAll).toHaveBeenCalledWith(userId, tripId);

    await request(app.getHttpServer())
      .get(`${basePath}/${proposalId}`)
      .set('Cookie', cookie)
      .expect(200, {
        proposal: { id: proposalId },
      });

    expect(mockService.findOne).toHaveBeenCalledWith(
      userId,
      tripId,
      proposalId,
    );
  });

  it('preserves the domain error when a Trip is inaccessible', async () => {
    mockService.findAll.mockRejectedValueOnce(
      new NotFoundException({
        error: {
          code: 'TRIP_NOT_FOUND',
          message: 'Trip not found',
          details: {},
        },
      }),
    );

    await request(app.getHttpServer())
      .get(basePath)
      .set('Cookie', cookie)
      .expect(404, {
        error: {
          code: 'TRIP_NOT_FOUND',
          message: 'Trip not found',
          details: {},
        },
      });
  });

  it('preserves the domain error for a missing Proposal', async () => {
    mockService.findOne.mockRejectedValueOnce(
      new NotFoundException({
        error: {
          code: 'PROPOSAL_NOT_FOUND',
          message: 'Proposal not found',
          details: {},
        },
      }),
    );

    await request(app.getHttpServer())
      .get(`${basePath}/${proposalId}`)
      .set('Cookie', cookie)
      .expect(404, {
        error: {
          code: 'PROPOSAL_NOT_FOUND',
          message: 'Proposal not found',
          details: {},
        },
      });
  });

  it('routes a valid Vote request to the Service', async () => {
    await request(app.getHttpServer())
      .put(`${basePath}/${proposalId}/vote`)
      .set('Cookie', cookie)
      .send({ decision: 'AGREE' })
      .expect(200, {
        proposal: {
          id: proposalId,
          currentUserDecision: 'AGREE',
        },
      });

    expect(mockService.vote).toHaveBeenCalledWith(
      userId,
      tripId,
      proposalId,
      expect.objectContaining({
        decision: 'AGREE',
      }),
    );
  });

    it('rejects invalid Vote bodies and extra fields', async () => {
    const invalidInputs = [
      {},
      { decision: 'PENDING' },
      { decision: 'INVALID' },
      { decision: null },
      { decision: 123 },
      { decision: 'AGREE', userId: randomUUID() },
      { decision: 'REJECT', status: 'ACCEPTED' },
    ];

    for (const input of invalidInputs) {
      await request(app.getHttpServer())
        .put(`${basePath}/${proposalId}/vote`)
        .set('Cookie', cookie)
        .send(input)
        .expect(400, validationError);
    }

    expect(mockService.vote).not.toHaveBeenCalled();
  });
    it('rejects malformed Vote resource IDs', async () => {
    await request(app.getHttpServer())
      .put('/api/trips/not-a-uuid/proposals/123/vote')
      .set('Cookie', cookie)
      .send({ decision: 'AGREE' })
      .expect(400, validationError);

    await request(app.getHttpServer())
      .put(`${basePath}/not-a-uuid/vote`)
      .set('Cookie', cookie)
      .send({ decision: 'REJECT' })
      .expect(400, validationError);

    expect(mockService.vote).not.toHaveBeenCalled();
  });
    it('preserves PROPOSAL_VOTING_CLOSED as HTTP 409', async () => {
    mockService.vote.mockRejectedValueOnce(
      new ConflictException({
        error: {
          code: 'PROPOSAL_VOTING_CLOSED',
          message: 'Proposal voting is closed',
          details: {},
        },
      }),
    );

    await request(app.getHttpServer())
      .put(`${basePath}/${proposalId}/vote`)
      .set('Cookie', cookie)
      .send({ decision: 'REJECT' })
      .expect(409, {
        error: {
          code: 'PROPOSAL_VOTING_CLOSED',
          message: 'Proposal voting is closed',
          details: {},
        },
      });
  });
});
