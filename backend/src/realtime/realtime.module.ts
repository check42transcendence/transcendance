
import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';

import { TripGateway } from './trip.gateway.js';
import { RealtimeAuthService } from './realtime-auth.service.js';
import { TripMembershipAccessService } from './trip-membership-access.service.js';
import { RealtimeService } from './realtime.service.js';

@Module({
imports: [
	AuthModule,
	PrismaModule,
],
providers: [
	TripGateway,
	RealtimeAuthService,
	TripMembershipAccessService,
	RealtimeService,
],
exports: [
	RealtimeService,
],
})
export class RealtimeModule {}
