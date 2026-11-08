import type { MembershipRole, UserSummary } from './common.types.js'

// Public information about one current trip member.
export interface TripMember {
    user: UserSummary
    role: MembershipRole
    joinedAt: string
}

// Response containing the current members of a trip.
export interface TripMembersResponse {
    members: TripMember[]
}

// Identify the invited user by either username or email.
export type CreateInvitationRequest =
    | { username: string; email?: never }
    | { email: string; username?: never }

// A pending invitation shown to its recipient.
export interface PendingInvitation {
    id: string
    status: 'PENDING'
    trip: {
        id: string,
        title: string,
        destination: string
        startDate: string
        endDate: string
    }
    invitedBy: UserSummary
    createdAt: string
}

// Response containing the current user's pending invitations.
export interface PendingInvitationsResponse {
    invitations: PendingInvitation[]
}

// Result returned when an invitation is accepted.
export interface MembershipResult {
    tripId: string
    userId: string
    role: 'MEMBER'
    joinedAt: string
}
