import {
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';

@Injectable()
export class JwtIdentityService {
	constructor(
		private readonly jwtService: JwtService,
	) {}

	async verifyToken(token: unknown): Promise<string> {
		if (typeof token !== 'string' || !token) {
			throw this.unauthorized();
		}

		try {
			const payload = await this.jwtService.verifyAsync<{
				sub?: unknown;
			}>(token);

			if (typeof payload.sub !=='string' || !isUUID(payload.sub)) 
			{
				throw this.unauthorized();
			}
			return payload.sub;
		} catch {
			throw this.unauthorized();
		}
	}

	private unauthorized(): UnauthorizedException {
		return new UnauthorizedException({
			error: {
				code: 'AUTHENTICATION_REQUIRED',
				message: 'Authentication required',
				details: {},
			},
		});
	}
}