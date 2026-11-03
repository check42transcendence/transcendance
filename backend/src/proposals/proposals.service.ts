
import {
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { CreateProposalDto } from './dto/create-proposal.dto.js';

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
