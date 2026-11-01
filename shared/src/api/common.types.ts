// Roles available to trip members.
export type MembershipRole = 'OWNER' | 'MEMBER'

// Public user information shared by API responses.
export interface UserSummary {
    id: string
    username: string
}
