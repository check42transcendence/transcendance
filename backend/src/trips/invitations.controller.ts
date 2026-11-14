import {
  Controller,
  Get,
  Inject,
  Query,
  Param,
  ParseUUIDPipe,
  Post,
  HttpCode,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { TripsService } from './trips.service.js';

// Expose invitation queries and decisions for the authenticated recipient.
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

  // Accept an invitation addressed to the current user.
  @Post(':invitationId/accept')
  accept(
    @CurrentUser() user: { sub: string },
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
  ) {
    return this.tripsService.acceptInvitation(user.sub, invitationId);
  }

  // Reject an invitation addressed to the current user.
  @Post(':invitationId/reject')
  @HttpCode(204)
  reject(
    @CurrentUser() user: { sub: string },
    @Param('invitationId', new ParseUUIDPipe()) invitationId: string,
  ) {
    return this.tripsService.rejectInvitation(user.sub, invitationId);
  }
}
