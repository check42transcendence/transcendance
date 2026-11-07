import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import { JwtIdentityService } from '../jwt-identity.service.js';

type AuthenticatedRequest = Request & {
  user?: {
    sub: string;
  };
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtIdentityService: JwtIdentityService,
    private readonly reflector: Reflector,
  ) {}

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
	const userId = await this.jwtIdentityService.verifyToken(token);

    request.user = { sub: userId };
    return true;
  }
}
