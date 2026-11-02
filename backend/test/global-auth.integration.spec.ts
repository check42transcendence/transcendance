import { randomUUID } from 'node:crypto';
import { Controller, Get } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { Public } from '../src/common/decorators/public.decorator.js';

// These routes exist only inside the test application.
@Controller('__guard_test__')
class AuthGuardProbeController {
  @Get('private')
  privateRoute() {
    return { ok: true };
  }

  @Public()
  @Get('public')
  publicRoute() {
    return { ok: true };
  }
}

const authError = {
  error: {
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Authentication required',
    details: {},
  },
};

describe('Global JWT guard (real HTTP requests)', () => {
  let app: INestApplication<App>;
  let validToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'local-global-guard-test-secret';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [AuthGuardProbeController],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    validToken = await moduleFixture.get(JwtService).signAsync({
      sub: randomUUID(),
    });

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('allows the public health endpoint without a cookie', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200, { status: 'ok' });
  });

  it('allows an explicitly public test route without a cookie', async () => {
    await request(app.getHttpServer())
      .get('/api/__guard_test__/public')
      .expect(200, { ok: true });
  });

  it('protects an otherwise unmarked route by default', async () => {
    await request(app.getHttpServer())
      .get('/api/__guard_test__/private')
      .expect(401, authError);
  });

  it('rejects a malformed JWT on an unmarked route', async () => {
    await request(app.getHttpServer())
      .get('/api/__guard_test__/private')
      .set('Cookie', 'token=not-a-jwt')
      .expect(401, authError);
  });

  it('rejects a signed JWT without a valid UUID subject', async () => {
    const token = await app.get(JwtService).signAsync({ sub: 'not-a-uuid' });
    await request(app.getHttpServer())
      .get('/api/__guard_test__/private')
      .set('Cookie', `token=${token}`)
      .expect(401, authError);
  });

  it('allows a properly signed JWT with a UUID subject', async () => {
    await request(app.getHttpServer())
      .get('/api/__guard_test__/private')
      .set('Cookie', `token=${validToken}`)
      .expect(200, { ok: true });
  });

  it('keeps auth/me private', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401, authError);
  });

  it('keeps logout publicly accessible and returning 204', async () => {
    await request(app.getHttpServer()).post('/api/auth/logout').expect(204);
  });

  it('does not replace missing-route 404 with an auth error', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/__unknown_guard_test__')
      .expect(404);

    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Not found', details: {} },
    });
  });
});
