import {
  Controller,
  Get,
  Inject,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { TripsService } from './trips.service.js';

// Expose invitation queries for the authenticated recipient.
@Controller('invitations')
export class InvitationsController {
  constructor(
    @Inject(TripsService)
    private readonly tripsService: TripsService,
  ) {}

  // List only the current user's pending invitations.
  @Get()
  findPending(
    @CurrentUser() user: { sub: string },
    @Query('status') status?: string,
  ) {
    return this.tripsService.findPendingInvitations(user.sub, status);
  }
}
