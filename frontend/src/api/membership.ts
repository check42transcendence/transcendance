import type {
    TripMembersResponse,
    CreateInvitationRequest,
    PendingInvitationsResponse,
} from '@tripcollab/shared'
import { apiClient, apiJson } from '../lib/http/api-client'

// Load the current members of a trip.
export function getTripMembers(
    tripId: string
): Promise<TripMembersResponse> {
    return apiJson<TripMembersResponse>(`/trips/${tripId}/members`)
}

// Leave the trip as a current member.
export async function leaveTrip(
    tripId: string
): Promise<void> {
    await apiClient(`/trips/${tripId}/leave`, {
        method: 'POST',
    })
}

// Invite a registered user by username or email.
export async function createTripInvitation(
    tripId: string,
    input: CreateInvitationRequest
): Promise<void> {
    await apiClient(`/trips/${tripId}/invitations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
    })
}

// Load pending invitations addressed to the current user.
export async function getPendingInvitations(): Promise<PendingInvitationsResponse> {
    return apiJson<PendingInvitationsResponse>(
        '/invitations?status=PENDING',
    )
}

// Accept an invitation addressed to the current user.
export async function acceptInvitation(
    invitationId: string,
): Promise<void> {
    await apiClient(`/invitations/${invitationId}/accept`, {
        method: 'POST',
    })
}

// Reject an invitation addressed to the current user.
export async function rejectInvitation(
    invitationId: string,
): Promise<void> {
    await apiClient(`/invitations/${invitationId}/reject`, {
        method: 'POST',
    })
}
