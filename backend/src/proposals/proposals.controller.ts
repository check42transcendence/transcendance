import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { ProposalsService } from './proposals.service.js';
import { CreateProposalDto } from './dto/create-proposal.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('trips/:tripId/proposals')
export class ProposalsController {
  constructor(
    @Inject(ProposalsService)
    private readonly proposalsService: ProposalsService,
  ) {}

  // Create a proposal in a trip.
  @Post()
  create(
    @CurrentUser() user: { sub: string },
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Body() input: CreateProposalDto,
  ) {
    return this.proposalsService.create(user.sub, tripId, input);
  }

  // List proposals in a trip.
  @Get()
  findAll(
    @CurrentUser() user: { sub: string },
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ) {
    return this.proposalsService.findAll(user.sub, tripId);
  }

  // Get one proposal in a trip.
  @Get(':proposalId')
  findOne(
    @CurrentUser() user: { sub: string },
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Param('proposalId', new ParseUUIDPipe()) proposalId: string,
  ) {
    return this.proposalsService.findOne(user.sub, tripId, proposalId);
  }
}