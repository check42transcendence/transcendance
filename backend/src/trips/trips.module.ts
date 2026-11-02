import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller.js';
import { TripsService } from './trips.service.js';
import { PrismaModule } from '../database/prisma.module.js';

// Connect trip endpoints and business logic to the shared database service.
@Module({
  imports: [PrismaModule],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}
