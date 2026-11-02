# P0 Shared Types Contract

Status: Frozen  
Scope: P0  
Owner: Tech Lead  
Depends on: `02-DOMAIN_MODEL.md`, `05-REST_API_CONTRACT.md`, `06-REALTIME_CONTRACT.md`

## Purpose

Defines the canonical logical TypeScript-facing P0 types shared across frontend, backend, REST DTOs, realtime payloads, validation, and tests.

## 1. Primitive Aliases

```ts
type UUID = string
type ISODate = string       // YYYY-MM-DD
type ISODateTime = string   // ISO 8601
type LocalTime = string     // HH:mm
```

## 2. Canonical Enums / Unions

```ts
type MembershipRole =
  | 'OWNER'
  | 'MEMBER'

type InvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'

type VoteDecision =
  | 'AGREE'
  | 'REJECT'

type ProposalStatus =
  | 'PENDING'
  | 'ACCEPTED'
```

`PENDING` is **not** a VoteDecision.

No Vote is represented by `null` / absence.

P0 has no Proposal `REJECTED` shared status. A REJECT Vote does not create a Proposal lifecycle transition.

## 3. User Types

```ts
interface UserSummary {
  id: UUID
  username: string
}

interface CurrentUser {
  id: UUID
  email: string
  username: string
}
```

Other Users' Email is not part of normal shared summaries.

## 4. Trip Types

```ts
interface TripSummary {
  id: UUID
  title: string
  destination: string
  startDate: ISODate
  endDate: ISODate
  description: string | null
  currentUserRole: MembershipRole
}

interface TripDetail extends TripSummary {
  createdBy: UserSummary
  createdAt: ISODateTime
}
```

## 5. Membership / Invitation Types

```ts
interface TripMember {
  user: UserSummary
  role: MembershipRole
  joinedAt: ISODateTime
}

interface MembershipResult {
  tripId: UUID
  userId: UUID
  role: 'MEMBER'
  joinedAt: ISODateTime
}

interface PendingInvitation {
  id: UUID
  status: 'PENDING'
  trip: {
    id: UUID
    title: string
    destination: string
    startDate: ISODate
    endDate: ISODate
  }
  invitedBy: UserSummary
  createdAt: ISODateTime
}
```

## 6. ItineraryDay

```ts
interface ItineraryDay {
  id: UUID
  tripId: UUID
  dayNumber: number
  date: ISODate
}
```

## 7. Activity

```ts
interface Activity {
  id: UUID
  tripId: UUID
  itineraryDayId: UUID
  proposalId: UUID | null

  title: string
  startTime: LocalTime
  endTime: LocalTime | null
  location: string | null
  description: string | null

  version: number

  createdBy: UserSummary
  updatedBy: UserSummary
  createdAt: ISODateTime
  updatedAt: ISODateTime
}
```

No P0 fields for:

```text
isLocked
confirmed
participants
unscheduled
customOrder
```

## 8. Vote Summary

```ts
interface SharedVoteSummary {
  agreeCount: number
  rejectCount: number
  pendingCount: number
  participantCount: number
  requiredAgreeCount: number
  canAdopt: boolean
}
```

Rules:

```text
pendingCount
= participantCount - agreeCount - rejectCount

requiredAgreeCount
= floor(participantCount / 2) + 1
```

`rejectCount` is part of the shared vote summary only. It does not create an automatic Proposal status transition.

```ts
type PersonalVoteState = VoteDecision | null
```

## 9. Proposal Types

```ts
interface SharedProposal {
  id: UUID
  tripId: UUID
  title: string
  description: string | null
  status: ProposalStatus
  createdBy: UserSummary
  createdAt: ISODateTime
  voteSummary: SharedVoteSummary
}

interface Proposal extends SharedProposal {
  currentUserDecision: PersonalVoteState
}
```

Room-wide events use `SharedProposal`.

## 10. Request Types

```ts
interface RegisterRequest {
  email: string
  username: string
  password: string
}

interface LoginRequest {
  email: string
  password: string
}

interface CreateTripRequest {
  title: string
  destination: string
  startDate: ISODate
  endDate: ISODate
  description?: string | null
}

type CreateInvitationRequest =
  | { username: string; email?: never }
  | { email: string; username?: never }

interface CreateActivityRequest {
  itineraryDayId: UUID
  title: string
  startTime: LocalTime
  endTime?: LocalTime | null
  location?: string | null
  description?: string | null
}

interface UpdateActivityRequest {
  expectedVersion: number
  itineraryDayId?: UUID
  title?: string
  startTime?: LocalTime
  endTime?: LocalTime | null
  location?: string | null
  description?: string | null
}

interface CreateProposalRequest {
  title: string
  description?: string | null
}

interface VoteRequest {
  decision: VoteDecision
}

interface AdoptProposalRequest {
  itineraryDayId: UUID
  title: string
  startTime: LocalTime
  endTime?: LocalTime | null
  location?: string | null
  description?: string | null
}
```

There is no `DeleteActivityRequest` in P0.

## 11. Activity Delete Result

```ts
interface DeleteActivityResult {
  deletedActivityId: UUID
  reopenedProposalId: UUID | null
}
```

## 12. Adoption Result

```ts
interface AdoptProposalResult {
  proposal: Proposal
  activity: Activity
}
```

## 13. API Error Types

```ts
interface ApiError {
  error: {
    code: ApiErrorCode
    message: string
    details?: unknown
  }
}
```

```ts
type ApiErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'AUTHENTICATION_REQUIRED'
  | 'EMAIL_ALREADY_EXISTS'
  | 'USERNAME_ALREADY_EXISTS'
  | 'TRIP_NOT_FOUND'
  | 'TRIP_OWNER_REQUIRED'
  | 'MEMBERSHIP_REQUIRED'
  | 'MEMBERSHIP_ALREADY_EXISTS'
  | 'OWNER_CANNOT_LEAVE'
  | 'INVITATION_NOT_FOUND'
  | 'INVITEE_NOT_FOUND'
  | 'INVITATION_ALREADY_PENDING'
  | 'INVITATION_NOT_PENDING'
  | 'ACTIVITY_NOT_FOUND'
  | 'ACTIVITY_DAY_INVALID'
  | 'ACTIVITY_VERSION_CONFLICT'
  | 'PROPOSAL_NOT_FOUND'
  | 'PROPOSAL_VOTING_CLOSED'
  | 'PROPOSAL_MAJORITY_LOST'
  | 'PROPOSAL_ALREADY_ACCEPTED'
  | 'VALIDATION_ERROR'
  | 'MALFORMED_REQUEST'
  | 'INTERNAL_ERROR'
  | 'ACCESS_DENIED'
  | 'NOT_FOUND'
  | 'STATE_CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'CLIENT_ERROR'
```

## 14. Realtime Base / Event Types

```ts
interface RealtimeEnvelope<T> {
  tripId: UUID
  occurredAt: ISODateTime
  data: T
}

interface ActivityCreatedEventData {
  activity: Activity
}

interface ActivityUpdatedEventData {
  activity: Activity
}

interface ActivityDeletedEventData {
  activityId: UUID
  reopenedProposalId: UUID | null
}

interface ProposalCreatedEventData {
  proposal: SharedProposal
}

interface ProposalVoteUpdatedEventData {
  proposalId: UUID
  voteSummary: SharedVoteSummary
}

interface ProposalAdoptedEventData {
  proposal: SharedProposal
  activity: Activity
}

interface ProposalReopenedEventData {
  proposal: SharedProposal
}
```

Conceptual event map:

```ts
interface ServerToClientEvents {
  'activity:created':
    (event: RealtimeEnvelope<ActivityCreatedEventData>) => void
  'activity:updated':
    (event: RealtimeEnvelope<ActivityUpdatedEventData>) => void
  'activity:deleted':
    (event: RealtimeEnvelope<ActivityDeletedEventData>) => void
  'proposal:created':
    (event: RealtimeEnvelope<ProposalCreatedEventData>) => void
  'proposal:vote-updated':
    (event: RealtimeEnvelope<ProposalVoteUpdatedEventData>) => void
  'proposal:adopted':
    (event: RealtimeEnvelope<ProposalAdoptedEventData>) => void
  'proposal:reopened':
    (event: RealtimeEnvelope<ProposalReopenedEventData>) => void
}
```

## 15. Optional vs Nullable

For PATCH-style request fields:

```text
omitted
→ unchanged

null
→ explicitly clear nullable field

value
→ replace
```

Stored response fields that are nullable remain present with value or `null`.

## 16. Runtime Validation

Static TypeScript types do not replace backend runtime validation.

Backend validates:

```text
UUID
Email
enum
date/time format
field length
cross-resource relationship
Membership/authorization
Activity version
Proposal vote math/state
```

## 17. Shared Definition Rule

Frontend/backend must use one authoritative shared definition for cross-layer types.

Exact package/folder layout is implementation detail.

## 18. Explicit Type Non-Goals

No P0 shared types for:

```text
ChatMessage
Notification
Friend
Expense
FileUpload
MapRoute
ActivityParticipant
ActivityLockState
UnscheduledActivity
ProposalDeadline
ProposalOption
ProposalEditRequest
ProposalRejectionState
RejectedProposalArchive
ReviseAndForkRequest
OwnershipTransfer
AuditHistory
OfflineMutationQueue
```
