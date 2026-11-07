import { Injectable } from '@nestjs/common';
import { MemberRole } from '../generated/prisma/client.js'
import { PrismaService } from '../database/prisma.service.js'

@Injectable()
export class TripMembershipAccessService {
	constructor(
		private readonly prisma: PrismaService,
	) {}
	async canSubscribe(
		userId: string,
		tripId: string,
	): Promise<boolean> {
		const membership = await this.prisma.tripMember.findUnique({
			where: {
				tripId_userId: {
					tripId,
					userId,
				},
			},
			select: {
				role: true,
			},
		});
		return (
			membership?.role === MemberRole.OWNER ||
			membership?.role === MemberRole.MEMBER
		);
	}
}