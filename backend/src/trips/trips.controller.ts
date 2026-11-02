import {
  Body,
  Controller,
  Inject,
  Post,
  Get,
  Delete,
  Param,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { TripsService } from './trips.service.js';
import { CreateTripDto } from './dto/create-trip.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('trips')
export class TripsController {
  constructor(
    @Inject(TripsService)
    private readonly tripsService: TripsService,
  ) {}

  // Passes the authenticated user ID and validated input to the service.
  @Post()
  create(@CurrentUser() user: { sub: string }, @Body() input: CreateTripDto) {
    return this.tripsService.create(user.sub, input);
  }

  // List trips for the authenticated user.
  @Get()
  findAll(@CurrentUser() user: { sub: string }) {
    return this.tripsService.findAll(user.sub);
  }

  // Validate the trip ID and request details for the current user.
  @Get(':tripId')
  findOne(
    @CurrentUser() user: { sub: string },
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ) {
    return this.tripsService.findOne(user.sub, tripId);
  }

  // Request itinerary days for the authenticated user.
  @Get(':tripId/days')
  findDays(
    @CurrentUser() user: { sub: string },
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ) {
    return this.tripsService.findDays(user.sub, tripId);
  }

  // Request trip deletion using the authenticated user's identity.
  @Delete(':tripId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: { sub: string },
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ) {
    return this.tripsService.remove(user.sub, tripId);
  }
}
