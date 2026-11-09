
import type { UserSummary } from './common.types.js'

export type ProposalStatus = 'PENDING' | 'ACCEPTED'

export type VoteDecision = 'AGREE' | 'REJECT'

export interface SharedVoteSummary {
    agreeCount: number
    rejectCount: number
    pendingCount: number
    participantCount: number
    requiredAgreeCount: number
    canAdopt: boolean
}

export interface SharedProposal {
    id: string
    tripId: string
    title: string
    description: string | null
    status: ProposalStatus
    createdBy: UserSummary
    createdAt: string
    voteSummary: SharedVoteSummary
}

export interface Proposal extends SharedProposal {
    currentUserDecision: VoteDecision | null
}

export interface CreateProposalRequest {
    title: string
    description?: string | null
}

export interface ProposalListResponse {
    proposals: Proposal[]
}

export interface ProposalResponse {
    proposal: Proposal
}
