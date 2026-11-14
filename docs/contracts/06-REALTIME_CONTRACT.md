# P0 Realtime Contract

Status: Frozen  
Scope: P0  
Owner: Tech Lead  
Depends on: `03-AUTH_CONTRACT.md`, `05-REST_API_CONTRACT.md`, `07-SHARED_TYPES.md`

## Purpose

Defines P0 live synchronization after committed REST/domain mutations.

## 1. Source of Truth

Database/backend state is authoritative.

Socket.IO is a notification/synchronization layer, not a second write API.

Required invariant:

```text
no success event before DB COMMIT
```

Rollback emits no success event.

## 2. Socket.IO Path

Browser-facing path:

```text
/socket.io
```

Socket.IO runs inside NestJS.

Nginx must proxy this path with WebSocket upgrade support.

## 3. Authentication

Socket handshake uses the same HttpOnly-cookie identity as REST.

Client-supplied User ID is not proof of identity.

Invalid/missing auth rejects the connection.

## 4. Trip Rooms

Canonical room:

```text
trip:<tripId>
```

Only current OWNER/MEMBER may subscribe.

Pending Invitation is insufficient.

### trip:subscribe

Client:

```json
{ "tripId": "uuid" }
```

Server checks current Membership before joining.


Subscription authorization and Room joining are one atomic operation:

- Lock the Trip row with `FOR SHARE`.
- Check current OWNER/MEMBER Membership while holding that lock.
- Keep the lock until `socket.join` completes and the socket is confirmed in the Room.
- Failed authorization, database queries, or joining must return a negative acknowledgement and attempt to leave the Room.
- Leave locks the same Trip row with `FOR UPDATE`, serializing Membership deletion against in-flight subscriptions.

### trip:unsubscribe

Removes only realtime subscription, not Membership.

## 5. Server-to-Client Events

```text
activity:created
activity:updated
activity:deleted

proposal:created
proposal:vote-updated
proposal:adopted
proposal:reopened
```

No domain writes use Socket.IO.

## 6. Common Envelope

```ts
{
  tripId: UUID
  occurredAt: ISODateTime
  data: ...
}
```

JSON uses camelCase.

## 7. Activity Events

### activity:created

Carries complete canonical Activity DTO.

### activity:updated

Carries complete latest Activity DTO including:

```text
version
updatedBy
updatedAt
```

Client may ignore an Activity event whose version is not newer than local canonical state.

Unsaved form input is not silently overwritten.

### activity:deleted

Carries:

```text
activityId
reopenedProposalId | null
```

If Proposal-sourced Activity deletion reopens a Proposal, `proposal:reopened` is also emitted after the same commit.

## 8. Proposal Events

### proposal:created

Carries `SharedProposal`.

Room broadcast excludes recipient-specific `currentUserDecision`.

### proposal:vote-updated

For every successful Vote create/change on a `PENDING` Proposal, broadcasts the latest absolute shared vote summary.

A REJECT Vote does not change Proposal status and does not emit a separate rejection event.

No `+1/-1` delta logic.

### proposal:adopted

Emitted after successful committed Adoption.

Carries latest shared Proposal state (`ACCEPTED`) and created Activity.

Failed Adoption emits no `proposal:adopted`.

### proposal:reopened

Emitted after deleting the Proposal-sourced Activity and committing:

```text
ACCEPTED → PENDING
```

Carries latest shared Proposal state.

## 9. Broadcast Audience

Events go to currently authorized sockets in the Trip room, including possibly the mutating User's socket.

Clients must handle duplicates idempotently.

Use explicit state values, never “toggle” operations.


Before sending a protected Trip event, the server must revalidate current Membership
for candidate sockets in the Trip Room:

- Only sockets belonging to current OWNER/MEMBER users may receive the event.
- Delivery is targeted to authorized sockets, not blindly broadcast to the entire Room.
- The server holds the Trip row with `FOR SHARE` through event delivery, serializing against Leave's `FOR UPDATE` lock.
- If the Trip or authorization query is unavailable, no event is sent (fail closed).
- A stale physical Room subscription is never proof of current authorization.

## 10. Membership Changes

After Member Leave commits:

- The server attempts to evict all of that User's sockets from the Trip Room, using bounded retries.
- Socket cleanup happens after the database transaction commits. Cleanup failure must not roll back Membership deletion or report that Leave failed.
- Broadcast-time Membership authorization must prevent a departed User from receiving protected events even if a stale socket remains in the Room.
- A departed User must be denied any later subscription attempt.

After Trip deletion, the room must stop protected Workspace delivery.

P0 does not require a realtime Member-list feature.

Membership changes may alter Proposal vote summaries/Adoption eligibility, but P0 defines no automatic Proposal status transition from those changes.

## 11. Reconnection / Resync

P0 has no durable event replay.

Reconnect flow:

```text
reconnect
→ authenticate
→ resubscribe
→ refetch authoritative REST state
→ resume realtime
```

Relevant state includes Trip, visible Members, Days, Activities, Proposals/Vote summaries.

Frontend must avoid an older REST snapshot overwriting a newer event; buffering during resync or a consistent refetch/version strategy is acceptable.

## 12. Delivery Semantics

P0 guarantees:

```text
broadcast only after successful commit
```

P0 does not guarantee:

```text
exactly-once delivery
durable delivery
offline replay
cross-connection ordering
```

## 13. Payload Privacy

Do not broadcast:

```text
password/hash
JWT/cookie
other Users' Email by default
another User's currentUserDecision
raw DB errors
```

## 14. Required Realtime Tests

At minimum:

1. unauthenticated socket rejected;
2. non-member cannot subscribe;
3. Owner/Member can subscribe;
4. Pending Invitation cannot subscribe;
5. Activity create/update/delete events occur only after commit;
6. Activity update contains new version/editor data;
7. stale Activity REST update emits no success event;
8. Proposal create event;
9. successful Vote change emits `proposal:vote-updated` with absolute summary;
10. REJECT Vote leaves Proposal `PENDING` and emits no rejection-status event;
11. successful Adoption emits `proposal:adopted`;
12. failed/lost-majority Adoption emits no adopted event;
13. double Adoption produces one success;
14. Proposal-sourced Activity delete emits delete + reopen state;
15. Leave stops protected Trip delivery;
16. reconnect requires resubscription + REST resync.

17. concurrent Subscribe and Leave serialize on the Trip row lock;
18. a stale Room socket without Membership receives no protected broadcast;
19. Socket cleanup failure after Leave commit does not restore Membership or Vote state.

## 15. Explicit Realtime Non-Goals

```text
Chat
Notification Center
presence
typing
cursor sharing
durable event history/replay
Activity edit locks
automatic Proposal rejection
proposal:rejected event
PWA offline mutation sync
```
