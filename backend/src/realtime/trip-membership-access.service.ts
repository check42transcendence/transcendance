import type { Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { MemberRole } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class TripMembershipAccessService {
  constructor(private readonly prisma: PrismaService) {}
  async joinIfCurrentMember(
    userId: string,
    tripId: string,
    socket: Socket,
  ): Promise<boolean> {
    const room = `trip:${tripId}`;

    return this.prisma.$transaction(async (tx) => {
      // Serialize subscription against Leave's FOR UPDATE lock.
      const lockedTrips = await tx.$queryRaw<Array<{ id: string }>>`
				SELECT "id"
				FROM "trip"
				WHERE "id" = ${tripId}::uuid
				FOR SHARE
			`;

      if (lockedTrips.length === 0) {
        return false;
      }

      // Read Membership while holding the Trip lock.
      const membership = await tx.tripMember.findUnique({
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

      if (
        (membership?.role !== MemberRole.OWNER &&
          membership?.role !== MemberRole.MEMBER) ||
        !socket.connected
      ) {
        return false;
      }

      // Keep the Trip lock until the Socket has joined the Room.
      await socket.join(room);

      if (!socket.connected || !socket.rooms.has(room)) {
        await Promise.resolve(socket.leave(room));
        return false;
      }

      return true;
    });
  }
}
