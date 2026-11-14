import { Injectable, Logger } from '@nestjs/common';

import type {
  RealtimeEnvelope,
  RealtimeEventName,
  ActivityRealtimeEventName,
  ActivityRealtimeEventData,
} from '@tripcollab/shared';

import { PrismaService } from '../database/prisma.service.js';
import { TripGateway } from './trip.gateway.js';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(
    private readonly gateway: TripGateway,
    private readonly prisma: PrismaService,
  ) {}

  private roomName(tripId: string): string {
    return `trip:${tripId}`;
  }

  /**
   * Broadcast only to sockets whose users still have
   * a current Membership in the Trip.
   *
   * The Trip row is locked FOR SHARE until delivery completes.
   * This serializes broadcasts against Leave's FOR UPDATE lock.
   * Database errors fail closed: no event is sent.
   */
  async emitToTrip<T>(
    tripId: string,
    eventName: RealtimeEventName,
    data: T,
  ): Promise<void> {
    const room = this.roomName(tripId);

    // Collect current sockets in this Trip room.
    const sockets = await this.gateway.server.in(room).fetchSockets();

    const candidates = sockets.filter(
      (socket) =>
        socket.rooms.has(room) && typeof socket.data.userId === 'string',
    );

    const userIds = [
      ...new Set(candidates.map((socket) => socket.data.userId as string)),
    ];

    if (userIds.length === 0) {
      return;
    }

    const payload: RealtimeEnvelope<T> = {
      tripId,
      occurredAt: new Date().toISOString(),
      data,
    };

    // Keep the shared Trip lock until all authorized emits have completed.
    await this.prisma.$transaction(async (tx) => {
      const lockedTrips = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "trip"
        WHERE "id" = ${tripId}::uuid
        FOR SHARE
      `;

      if (lockedTrips.length === 0) {
        return;
      }

      const memberships = await tx.tripMember.findMany({
        where: {
          tripId,
          userId: { in: userIds },
        },
        select: {
          userId: true,
        },
      });

      const authorizedUserIds = new Set(
        memberships.map((membership) => membership.userId),
      );

      for (const socket of candidates) {
        const userId: unknown = socket.data.userId;

        if (
          typeof userId !== 'string' ||
          !authorizedUserIds.has(userId) ||
          !socket.rooms.has(room)
        ) {
          continue;
        }

        // Target this socket only; do not broadcast to the whole Room.
        this.gateway.server.to(socket.id).emit(eventName, payload);
      }
    });
  }

  /**
   * Strictly typed Activity broadcast.
   */
  async emitActivityToTrip<K extends ActivityRealtimeEventName>(
    tripId: string,
    eventName: K,
    data: ActivityRealtimeEventData[K],
  ): Promise<void> {
    await this.emitToTrip(tripId, eventName, data);
  }

  /**
   * Remove every socket belonging to one user
   * from a particular Trip room.
   */
  async removeUserFromTrip(userId: string, tripId: string): Promise<void> {
    const room = this.roomName(tripId);
    const maxAttempts = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        // Fetch the room again on every attempt.
        const sockets = await this.gateway.server.in(room).fetchSockets();

        for (const socket of sockets) {
          if (socket.data.userId === userId) {
            await Promise.resolve(socket.leave(room));
          }
        }

        return;
      } catch (error: unknown) {
        lastError = error;

        this.logger.warn(
          `Socket cleanup attempt ${attempt}/${maxAttempts} failed for tripId=${tripId}, userId=${userId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );

        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        }
      }
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error(`Unable to remove user ${userId} from Trip room ${tripId}`);
  }

  /**
   * Remove all sockets from one Trip room.
   * Intended for successful Trip deletion.
   */
  async removeTripRoom(tripId: string): Promise<void> {
    const room = this.roomName(tripId);

    this.gateway.server.in(room).socketsLeave(room);
  }
}
