import { Module } from '@nestjs/common';

import { TripsController } from './trips.controller.js';
import { InvitationsController } from './invitations.controller.js';

import { TripsService } from './trips.service.js';

import { PrismaModule } from '../database/prisma.module.js';

import { UsersModule } from '../users/users.module.js';

import { RealtimeModule } from '../realtime/realtime.module.js';

// Connect trip endpoints to database and user lookup services.
@Module({
  imports: [PrismaModule, UsersModule, RealtimeModule,],
  controllers: [TripsController, InvitationsController],
  providers: [TripsService],
})
export class TripsModule {}
