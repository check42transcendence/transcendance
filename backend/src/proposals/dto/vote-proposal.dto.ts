import { IsIn } from 'class-validator';
import type { VoteRequest } from '@tripcollab/shared';

export class VoteProposalDto implements VoteRequest {
  @IsIn(['AGREE', 'REJECT'])
  decision!: VoteRequest['decision'];
}