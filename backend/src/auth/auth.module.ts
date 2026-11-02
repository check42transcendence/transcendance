import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { UsersRepository } from '../users/users.repository.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import {
  AuthPasswordService,
  AuthUserRepository,
} from './auth.dependencies.js';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { hash, verify } from './utils/password.util.js';
import { AuthSessionService } from './auth-session.service.js';
import { APP_GUARD } from '@nestjs/core';

// Connects auth routes, user storage, password tools, and JWT support.
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error(
            'Fatal: The JWT SECRET environment variable is missing, and the server refuses to start',
          );
        }

        return {
          secret: secret,
          signOptions: { expiresIn: '7d' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionService,
    JwtAuthGuard,
    {
      provide: APP_GUARD,
      useExisting: JwtAuthGuard,
    },
    // Uses the existing PostgreSQL user repository.
    {
      provide: AuthUserRepository,
      useExisting: UsersRepository,
    },
    // Uses the shared bcrypt password functions.
    {
      provide: AuthPasswordService,
      useValue: { hash, verify },
    },
  ],
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
