import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { isUUID } from 'class-validator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';

type AuthenticatedRequest = Request & {
  user?: {
    sub: string;
  };
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService)
    private readonly jwtService: JwtService,

    @Inject(Reflector)
    private readonly reflector: Reflector,
  ) {}

  private authenticationRequired(): UnauthorizedException {
    return new UnauthorizedException({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
        details: {},
      },
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // WebSocket authentication is handled separately.
    if (context.getType() !== 'http') {
      return true;
    }

    // Explicitly public HTTP routes skip JWT verification.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token: unknown = request.cookies?.token;

    if (typeof token !== 'string' || token.length === 0) {
      throw this.authenticationRequired();
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: unknown;
      }>(token);

      if (typeof payload.sub !== 'string' || !isUUID(payload.sub)) {
        throw this.authenticationRequired();
      }

      request.user = { sub: payload.sub };
      return true;
    } catch {
      throw this.authenticationRequired();
    }
  }
}
