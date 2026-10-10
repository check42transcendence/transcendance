# P0 Shared Technical Contracts

Status: Draft  
Scope: P0  
Owner: Tech Lead  
Product baseline: Frozen P0 Scope / PRD / Business Rules v2 — 2026-10-09

## Purpose

This directory contains the shared technical contracts for P0.

These contracts define the technical rules that multiple team members must follow when developing independent Vertical Slices.

They are based on the frozen P0 Scope and P0 Business Rules.

A frozen product baseline does not automatically freeze the technical contracts. Each technical contract still follows its own review lifecycle.

## Contract documents

0. `00-DOMAIN_VOCABULARY.md`
   - Canonical P0 terminology
   - Shared meanings for User, Trip, Membership, Activity, Proposal, Vote, Adoption, and related concepts

1. `01-ARCHITECTURE.md`
   - Overall system structure
   - Technology stack
   - Frontend / backend / database responsibilities
   - Main communication paths
   - P0 i18n-ready frontend boundary

2. `02-DOMAIN_MODEL.md`
   - Core P0 domain objects
   - Entity meanings
   - Relationships and lifecycle rules
   - Membership roles, Proposal adoption, and linked Activity rules

3. `03-AUTH_CONTRACT.md`
   - Authentication approach
   - Authorization rules
   - OWNER / MEMBER access boundaries
   - Proposal voting and adoption authorization

4. `04-DATABASE_CONTRACT.md`
   - Database conventions
   - Primary keys and foreign keys
   - Unique constraints
   - Deletion rules
   - Prisma migration rules
   - Concurrent update and adoption atomicity requirements

5. `05-REST_API_CONTRACT.md`
   - REST API naming conventions
   - Request / response conventions
   - HTTP status codes
   - Common error format
   - P0 shared API contracts

6. `06-REALTIME_CONTRACT.md`
   - Socket.IO connection rules
   - Trip room strategy
   - Event naming conventions
   - Reconnection and synchronization rules
   - Proposal adoption synchronization

7. `07-SHARED_TYPES.md`
   - Shared enums
   - Shared DTO conventions
   - Types used across REST and realtime contracts

8. `08-ENVIRONMENT_AND_WORKFLOW.md`
   - Node version
   - Docker services
   - Ports
   - Environment variables
   - CI baseline
   - Prisma migration workflow
   - i18n-ready frontend workflow
   - Contract change workflow

## Contract lifecycle

Each contract follows:

```text
Draft → Team Review → Frozen
```

### Draft

The contract is still being designed and may change.

### Team Review

The proposed contract is ready for the team to check for conflicts or missing requirements.

### Frozen

The contract is the current shared technical agreement for P0.

Frozen does not mean that a contract can never change.

A change that affects multiple Vertical Slices must be discussed and the shared contract must be updated before dependent implementations are changed.

## Source of truth

For P0:

1. Frozen P0 Scope defines what P0 includes.
2. Frozen P0 Business Rules define how the product behaves.
3. `00-DOMAIN_VOCABULARY.md` defines the shared language used by the team.
4. These Technical Contracts define how the shared technical system supports those rules.
5. Feature implementations must follow the frozen technical contracts.

If a lower layer conflicts with a higher layer, the higher layer wins until the conflict is explicitly reviewed.

```text
P0 Scope / Business Rules
        ↓
Domain Vocabulary / Domain Model
        ↓
Technical Contracts
        ↓
ERD / Prisma / REST / Realtime implementation
```

## Scope rule

These documents define shared technical boundaries only.

They should not prescribe private implementation details that affect only one Vertical Slice and do not create dependencies for other team members.
