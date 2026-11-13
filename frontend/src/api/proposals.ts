import { apiJson, apiPostJson } from '../lib/http/api-client'
import type {
    CreateProposalRequest,
    ProposalListResponse,
    ProposalResponse,
} from '@tripcollab/shared'

// List Proposals belonging to the current Trip.
export function getProposals(tripId: string): Promise<ProposalListResponse> {
    return apiJson<ProposalListResponse>(`/trips/${tripId}/proposals`)
}

// Load one Proposal with its voting summary.
export function getProposal(
    tripId: string,
    proposalId: string,
): Promise<ProposalResponse> {
    return apiJson<ProposalResponse>(`/trips/${tripId}/proposals/${proposalId}`)
}

// Create a Proposal in the current Trip.
export function createProposal(
    tripId: string,
    input: CreateProposalRequest,
): Promise<ProposalResponse> {
    return apiPostJson<ProposalResponse>(`/trips/${tripId}/proposals`, input)
}
