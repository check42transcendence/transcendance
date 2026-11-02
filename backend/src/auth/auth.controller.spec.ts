import { Test } from '@nestjs/testing';
import request from 'supertest';
import { vi } from 'vitest';
import { AuthModule } from './auth.module.js';
import { MockAuthPasswordService } from './mocks/mock-auth-password.service.js';
import { MockAuthUserStore } from './mocks/mock-auth-user.store.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  AuthPasswordService,
  AuthUserRepository,
} from './auth.dependencies.js';
import { AuthSessionService } from './auth-session.service.js';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';

// Tests auth routes with mock users and passwords, using real JWT sessions.
describe('AuthController login', () => {
  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', 'test-only-secret-for-auth');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
  // Starts a session after login, but not after registration.
  it('calls the session tool after successful verification', async () => {
    const module = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(AuthUserRepository)
      .useClass(MockAuthUserStore)
      .overrideProvider(AuthPasswordService)
      .useClass(MockAuthPasswordService)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    const passwords = module.get<MockAuthPasswordService>(AuthPasswordService);
    passwords.verificationSucceeds = true;

    const sessions = module.get(AuthSessionService);
    const startSpy = vi.spyOn(sessions, 'start');

    const app = module.createNestApplication();
    app.setGlobalPrefix('api');

    try {
      await app.init();

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'yihe@example.com',
          username: 'yihe',
          password: 'example-password',
        })
        .expect(201);

      expect(startSpy).not.toHaveBeenCalled();

      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'yihe@example.com',
          password: 'example-password',
        })
        .expect(200);

      expect(response.body).toEqual({
        user: {
          id: expect.any(String),
          email: 'yihe@example.com',
          username: 'yihe',
        },
      });

      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(startSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
      );
    } finally {
      await app.close();
      vi.restoreAllMocks();
    }
  });

  // Clears the session and returns an empty response.
  it('calls the session clear tool and returns 204', async () => {
    const module = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(AuthUserRepository)
      .useClass(MockAuthUserStore)
      .overrideProvider(AuthPasswordService)
      .useClass(MockAuthPasswordService)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    const sessions = module.get(AuthSessionService);
    const clearSpy = vi.spyOn(sessions, 'clear');

    const app = module.createNestApplication();
    app.setGlobalPrefix('api');

    try {
      await app.init();

      const response = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .expect(204);

      expect(response.text).toBe('');
      expect(clearSpy).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
      vi.restoreAllMocks();
    }
  });

  // Loads the user identified by a valid JWT.
  it('returns the user identified by the JWT', async () => {
    const module = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(AuthUserRepository)
      .useClass(MockAuthUserStore)
      .overrideProvider(AuthPasswordService)
      .useClass(MockAuthPasswordService)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    const users = module.get(AuthUserRepository);

    const user = await users.create({
      email: 'yihe@example.com',
      username: 'yihe',
      passwordHash: 'mock-password-hash',
    });

    const jwt = module.get(JwtService);
    const token = await jwt.signAsync({ sub: user.id });

    const app = module.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');

    try {
      await app.init();

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', `token=${token}`)
        .expect(200)
        .expect({
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
          },
        });
    } finally {
      await app.close();
      vi.restoreAllMocks();
    }
  });

  // Rejects current-user requests without an authentication cookie.
  it('rejects unauthenticated requests to me', async () => {
    const module = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(AuthUserRepository)
      .useClass(MockAuthUserStore)
      .overrideProvider(AuthPasswordService)
      .useClass(MockAuthPasswordService)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    const app = module.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');

    try {
      await app.init();

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401)
        .expect({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            details: {},
          },
        });
    } finally {
      await app.close();
    }
  });

  // Rejects requests containing an invalid JWT.
  it('rejects requests to me with an invalid token', async () => {
    const module = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(AuthUserRepository)
      .useClass(MockAuthUserStore)
      .overrideProvider(AuthPasswordService)
      .useClass(MockAuthPasswordService)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    const app = module.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');

    try {
      await app.init();

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', 'token=invalid-token')
        .expect(401)
        .expect({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            details: {},
          },
        });
    } finally {
      await app.close();
    }
  });
});
