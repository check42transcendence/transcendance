import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Post,
  Param,
  ParseUUIDPipe,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { Public } from '../src/common/decorators/public.decorator.js';
import { ApiExpressAdapter } from '../src/common/http/api-express.adapter.js';

// Routes exist only inside this test, never in the production AppModule.
@Public()
@Controller('__filter_test__')
class ErrorProbeController {
  @Get('forbidden')
  forbidden(): never {
    throw new ForbiddenException();
  }

  @Get('domain-forbidden')
  domainForbidden(): never {
    throw new ForbiddenException({
      error: {
        code: 'TRIP_OWNER_REQUIRED',
        message: 'Trip owner required',
        details: {},
      },
    });
  }

  @Get('domain-not-found')
  domainNotFound(): never {
    throw new NotFoundException({
      error: {
        code: 'ACTIVITY_NOT_FOUND',
        message: 'Activity not found',
        details: {},
      },
    });
  }

  @Get('domain-conflict')
  domainConflict(): never {
    throw new ConflictException({
      error: {
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'Email already exists',
        details: {},
      },
    });
  }

  @Get('validation')
  validation(): never {
    throw new BadRequestException({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request input',
        details: {},
      },
    });
  }

  @Get('unexpected')
  unexpected(): never {
    throw new Error('Database connection password=secret');
  }

  @Post('json')
  acceptJson(): { ok: boolean } {
    return { ok: true };
  }

  @Get('unsupported-media-type')
  unsupportedMediaType(): never {
    throw new UnsupportedMediaTypeException();
  }

  @Get('generic-conflict')
  genericConflict(): never {
    throw new ConflictException();
  }
  @Get('generic-bad-request')
  genericBadRequest(): never {
    throw new BadRequestException();
  }

  @Get('uuid/:value')
  checkUuid(
    @Param('value', new ParseUUIDPipe({ version: '4' }))
    value: string,
  ) {
    return { value };
  }
}

const errorBody = (code: string, message: string) => ({
  error: { code, message, details: {} },
});

describe('Global HTTP exception filter (real HTTP requests)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'local-integration-test-secret';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ErrorProbeController],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication(new ApiExpressAdapter());
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });
  it('normalizes a generic 400 to VALIDATION_ERROR', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/__filter_test__/generic-bad-request')
      .expect(400);

    expect(response.body).toEqual(
      errorBody('VALIDATION_ERROR', 'Invalid request input'),
    );
  });

  it('returns VALIDATION_ERROR for an invalid UUID parameter', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/__filter_test__/uuid/not-a-uuid')
      .expect(400);

    expect(response.body).toEqual(
      errorBody('VALIDATION_ERROR', 'Invalid request input'),
    );
  });
  it('does not change the public health endpoint', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200, { status: 'ok' });
  });

  it('returns 400 MALFORMED_REQUEST for invalid JSON', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/__filter_test__/json')
      .set('Content-Type', 'application/json')
      .send('{"broken":')
      .expect(400);

    expect(response.body).toEqual(
      errorBody('MALFORMED_REQUEST', 'Malformed request'),
    );
  });

  it('returns 413 for an oversized JSON request', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/__filter_test__/json')
      .set('Content-Type', 'application/json')
      .send({ data: 'x'.repeat(200_000) })
      .expect(413);

    expect(response.body).toEqual(
      errorBody('PAYLOAD_TOO_LARGE', 'Request body too large'),
    );
  });

  it('preserves an unclassified HTTP 415 status', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/__filter_test__/unsupported-media-type')
      .expect(415);

    expect(response.body).toEqual(
      errorBody('CLIENT_ERROR', 'Client request error'),
    );
  });

  it('preserves intentional 400 VALIDATION_ERROR responses', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/__filter_test__/validation')
      .expect(400);

    expect(response.body).toEqual(
      errorBody('VALIDATION_ERROR', 'Invalid request input'),
    );
  });

  it('keeps the existing 401 auth behavior for /api/auth/me', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401);

    expect(response.body).toEqual(
      errorBody('AUTHENTICATION_REQUIRED', 'Authentication required'),
    );
  });

  it('returns 403 ACCESS_DENIED for a generic forbidden error', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/__filter_test__/forbidden')
      .expect(403);

    expect(response.body).toEqual(errorBody('ACCESS_DENIED', 'Access denied'));
  });

  it('returns 404 NOT_FOUND for an unknown API path', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/__definitely_unknown_route__')
      .expect(404);

    expect(response.body).toEqual(errorBody('NOT_FOUND', 'Not found'));
  });

  it('preserves a domain-specific 403 error', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/__filter_test__/domain-forbidden')
      .expect(403);

    expect(response.body).toEqual(
      errorBody('TRIP_OWNER_REQUIRED', 'Trip owner required'),
    );
  });

  it('preserves a domain-specific 404 error', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/__filter_test__/domain-not-found')
      .expect(404);

    expect(response.body).toEqual(
      errorBody('ACTIVITY_NOT_FOUND', 'Activity not found'),
    );
  });

  it('preserves an intentional 409 business error', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/__filter_test__/domain-conflict')
      .expect(409);

    expect(response.body).toEqual(
      errorBody('EMAIL_ALREADY_EXISTS', 'Email already exists'),
    );
  });

  it('returns safe 500 INTERNAL_ERROR without leaking secrets', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/__filter_test__/unexpected')
      .expect(500);

    expect(response.body).toEqual(
      errorBody('INTERNAL_ERROR', 'Internal server error'),
    );
    expect(response.text).not.toContain('password=secret');
  });
  it('normalizes a generic 409 to STATE_CONFLICT', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/__filter_test__/generic-conflict')
      .expect(409);

    expect(response.body).toEqual(
      errorBody('STATE_CONFLICT', 'State conflict'),
    );
  });
});
