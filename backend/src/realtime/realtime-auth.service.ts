import { Injectable } from '@nestjs/common'
import { parse } from 'cookie'
import { JwtIdentityService } from '../auth/jwt-identity.service.js';

@Injectable()
export class RealtimeAuthService {
	constructor(
		private readonly jwtIdentityService: JwtIdentityService,
	) {}
	async authenticate(
		cookieHeader: string | undefined,
	): Promise<string> {
		const cookies = parse(cookieHeader ?? '');
		const token = cookies.token;
		return this.jwtIdentityService.verifyToken(token);
	}
}