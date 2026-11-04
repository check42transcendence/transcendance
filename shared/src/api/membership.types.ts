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
