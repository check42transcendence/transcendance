
import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { CreateProposalDto } from './dto/create-proposal.dto.js';
import { VoteProposalDto } from './dto/vote-proposal.dto.js';

type ProposalRecord = {
  id: string;
  tripId: string;
  title: string;
  description: string | null;
  status: 'PENDING' | 'ACCEPTED';
  createdAt: Date;
  creator: {
    id: string;
    username: string;
  };
  votes: {
    userId: string;
    decision: 'AGREE' | 'REJECT';
  }[];
};

@Injectable()
export class ProposalsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  private tripNotFound(): never {
    throw new NotFoundException({
      error: {
        code: 'TRIP_NOT_FOUND',
        message: 'Trip not found',
        details: {},
      },
    });
  }

  // Check membership within the current transaction.
  private async requireTripMember(
    tx: Prisma.TransactionClient,
    userId: string,
    tripId: string,
  ): Promise<void> {
    const membership = await tx.tripMember.findUnique({
      where: {
        tripId_userId: {
          tripId: tripId,
          userId: userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!membership) {
      this.tripNotFound();
    }
  }

// Protect the Trip from deletion while creating a Proposal.
private async lockTrip(
  tx: Prisma.TransactionClient,
  tripId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM "trip"
    WHERE id = ${tripId}::uuid
    FOR KEY SHARE
  `;

  if (rows.length === 0) {
    this.tripNotFound();
  }
}
  // Lock membership against concurrent deletion during creation.
  private async lockTripMember(
    tx: Prisma.TransactionClient,
    userId: string,
    tripId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM trip_member
      WHERE trip_id = ${tripId}::uuid
        AND user_id = ${userId}::uuid
      FOR UPDATE
    `;

    if (rows.length === 0) {
      this.tripNotFound();
    }
  }

  private toResponse(
    proposal: ProposalRecord,
    participantCount: number,
    userId: string,
  ) {
    const agreeCount = proposal.votes.filter(
      (vote) => vote.decision === 'AGREE',
    ).length;

    const rejectCount = proposal.votes.filter(
      (vote) => vote.decision === 'REJECT',
    ).length;

    const requiredAgreeCount = Math.floor(participantCount / 2) + 1;

    const currentUserVote = proposal.votes.find(
      (vote) => vote.userId === userId,
    );

    return {
      id: proposal.id,
      tripId: proposal.tripId,
      title: proposal.title,
      description: proposal.description,
      status: proposal.status,
      createdBy: {
        id: proposal.creator.id,
        username: proposal.creator.username,
      },
      createdAt: proposal.createdAt.toISOString(),
      voteSummary: {
        agreeCount,
        rejectCount,
        pendingCount: participantCount - agreeCount - rejectCount,
        participantCount,
        requiredAgreeCount,
        canAdopt:
          proposal.status === 'PENDING' &&
          agreeCount >= requiredAgreeCount,
      },
      currentUserDecision: currentUserVote?.decision ?? null,
    };
  }

  // Create a Proposal while holding the creator's membership lock.
  async create(
    userId: string,
    tripId: string,
    input: CreateProposalDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
 	 // Always lock the parent Trip before its Membership.
  	await this.lockTrip(tx, tripId);
 	await this.lockTripMember(tx, userId, tripId);

      const proposal = await tx.proposal.create({
        data: {
          tripId: tripId,
          title: input.title,
          description: input.description ?? null,
          createdBy: userId,
        },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
          votes: {
            select: {
              userId: true,
              decision: true,
            },
          },
        },
      });

      const participantCount = await tx.tripMember.count({
        where: {
          tripId: tripId,
        },
      });

      return {
        proposal: this.toResponse(proposal, participantCount, userId),
      };
    });
  }
  
  // Create or change one vote while preserving Trip/Proposal lock order.
  async vote(
    userId: string,
    tripId: string,
    proposalId: string,
    input: VoteProposalDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock the parent Trip first.
      const lockedTrips = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM "trip"
        WHERE id = ${tripId}::uuid
        FOR UPDATE
      `;

      if (lockedTrips.length === 0) {
        this.tripNotFound();
      }

      // 2. Verify current Trip membership.
      await this.requireTripMember(tx, userId, tripId);

      // 3. Lock the Proposal, scoped to the requested Trip.
      const lockedProposals = await tx.$queryRaw<
        Array<{ id: string; status: string }>
      >`
        SELECT id, status
        FROM "proposal"
        WHERE id = ${proposalId}::uuid
          AND trip_id = ${tripId}::uuid
        FOR UPDATE
      `;

      if (lockedProposals.length === 0) {
        throw new NotFoundException({
          error: {
            code: 'PROPOSAL_NOT_FOUND',
            message: 'Proposal not found',
            details: {},
          },
        });
      }

      // 4. Votes can be changed only while the Proposal is PENDING.
      if (lockedProposals[0].status !== 'PENDING') {
        throw new ConflictException({
          error: {
            code: 'PROPOSAL_VOTING_CLOSED',
            message: 'Proposal voting is closed',
            details: {},
          },
        });
      }

      // 5. Insert a first vote or update the existing vote.
      await tx.proposalVote.upsert({
        where: {
          proposalId_userId: {
            proposalId,
            userId,
          },
        },
        create: {
          proposalId,
          userId,
          decision: input.decision,
        },
        update: {
          decision: input.decision,
          votedAt: new Date(),
        },
      });

      // 6. Read the updated Proposal with votes from current members.
      const proposal = await tx.proposal.findUniqueOrThrow({
        where: {
          id: proposalId,
        },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
          votes: {
            where: {
              user: {
                memberships: {
                  some: {
                    tripId,
                  },
                },
              },
            },
            select: {
              userId: true,
              decision: true,
            },
          },
        },
      });

      // 7. Count current Trip participants.
      const participantCount = await tx.tripMember.count({
        where: {
          tripId,
        },
      });

      // 8. Reuse the existing canonical response and majority calculation.
      return {
        proposal: this.toResponse(
          proposal,
          participantCount,
          userId,
        ),
      };
    });
  }

  // Read the list using one consistent database snapshot.
  async findAll(userId: string, tripId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.requireTripMember(tx, userId, tripId);

        const proposals = await tx.proposal.findMany({
          where: {
            tripId: tripId,
          },
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
          include: {
            creator: {
              select: {
                id: true,
                username: true,
              },
            },
            votes: {
              where: {
                user: {
                  memberships: {
                    some: {
                      tripId: tripId,
                    },
                  },
                },
              },
              select: {
                userId: true,
                decision: true,
              },
            },
          },
        });

        const participantCount = await tx.tripMember.count({
          where: {
            tripId: tripId,
          },
        });

        return {
          proposals: proposals.map((proposal) =>
            this.toResponse(proposal, participantCount, userId),
          ),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }

  // Read one Proposal from the same consistent snapshot.
  async findOne(
    userId: string,
    tripId: string,
    proposalId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.requireTripMember(tx, userId, tripId);

        const proposal = await tx.proposal.findFirst({
          where: {
            id: proposalId,
            tripId: tripId,
          },
          include: {
            creator: {
              select: {
                id: true,
                username: true,
              },
            },
            votes: {
              where: {
                user: {
                  memberships: {
                    some: {
                      tripId: tripId,
                    },
                  },
                },
              },
              select: {
                userId: true,
                decision: true,
              },
            },
          },
        });

        if (!proposal) {
          throw new NotFoundException({
            error: {
              code: 'PROPOSAL_NOT_FOUND',
              message: 'Proposal not found',
              details: {},
            },
          });
        }

        const participantCount = await tx.tripMember.count({
          where: {
            tripId: tripId,
          },
        });

        return {
          proposal: this.toResponse(proposal, participantCount, userId),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }
}
