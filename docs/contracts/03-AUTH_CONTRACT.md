# P0 Authentication & Authorization Contract

Status: Draft  
Scope: P0  
Owner: Tech Lead  
Depends on: Frozen P0 Scope, Frozen P0 Business Rules v2, `00-DOMAIN_VOCABULARY.md`, `01-ARCHITECTURE.md`, `02-DOMAIN_MODEL.md`

## 1. Authentication

P0 uses Email + Password.

JWT is carried in an HttpOnly cookie.

JWT proves identity only and does not contain authoritative Trip role state.

---

# 2. Trip Access

A User may access a Trip Workspace only if a current TripMembership exists.

Allowed roles:

```text
OWNER
MEMBER
```

Historical `trip.created_by` is not an authorization source.

---

# 3. Owner Authorization

Owner authority is determined only by:

```text
TripMembership.role == OWNER
```

Owner-only P0 operations:

- Invite User;
- Delete Trip.

P0 has no Edit Trip.

Owner cannot Leave.

---

# 4. Current Participant Operations

Both OWNER and MEMBER may:

- view Trip/Member List/Itinerary;
- CRUD Activities;
- create/view Proposals;
- vote/change their own Vote while Proposal is not Adopted;
- manually Adopt an eligible Proposal.

---

# 5. Invitation Authorization

Only Owner creates Invitation.

Only the target User may Accept/Reject their Invitation.

Pending Invitation does not grant Workspace access.

---

# 6. Leave Authorization

Only role `MEMBER` may leave their own Membership.

After Leave:

- access ends immediately;
- historical Activity/Proposal remains;
- their Vote no longer counts.

---

# 7. Activity Authorization

Backend verifies:

- authenticated User;
- current TripMembership;
- Activity belongs to that Trip;
- Activity belongs to a valid Day;
- concurrency requirements.

Recent-editor identity/time come from backend context, not client-supplied identity.

Deleting an Activity that was created through Proposal Adoption must trigger the corresponding Proposal adoption-state reset defined by Domain/Database contracts.

---

# 8. Proposal / Vote Authorization

Current participants may create Proposals.

Users may create/change only their own Vote.

Vote decision:

```text
AGREE
REJECT
```

Vote creation/change is allowed only while:

```text
Proposal.is_adopted == false
```

After Adoption it is closed.

If the adopted Activity is later deleted and `is_adopted` returns to `false`, normal pre-Adoption voting authorization applies again.

---

# 9. Adoption Authorization

Any current participant may request Adoption.

Backend must verify:

- acting User still has current Membership;
- Proposal belongs to accessible Trip;
- `Proposal.is_adopted == false`;
- current AGREE count strictly exceeds half of current participant count;
- required Activity data is valid;
- no duplicate current Activity can be created from the same Proposal.

On successful atomic persistence:

```text
create Proposal-sourced Activity
set Proposal.is_adopted = true
```

`is_adopted` is the adoption marker only.

The exact Proposal-to-Activity FK direction/constraint belongs to the Database Contract.

---

# 10. REST Auth Errors

- missing/invalid auth → `401`
- authenticated but insufficient permission → `403`

Business conflicts such as stale Activity version, insufficient majority, already adopted Proposal, or concurrent duplicate Adoption are not auth failures.

---

# 11. Socket.IO Auth

Socket.IO uses the same backend-authenticated identity.

Trip-room access requires current TripMembership.

Pending Invitation is insufficient.

When Membership ends, protected realtime delivery must stop.

---

# 12. Frontend Rules

Frontend may shape UI from current state, but cannot replace backend authorization.

Frontend must not:

- read HttpOnly JWT;
- use localStorage/sessionStorage as auth source;
- treat Creator as Owner authorization;
- trust a locally stored role without backend verification;
- send User ID as proof of identity.
