# P0 Shared Technical Contracts

Status: Draft  
Scope: P0  
Owner: Tech Lead

## Purpose

This directory contains the shared technical contracts for P0.

These contracts define the technical rules that multiple team members must follow when developing independent Vertical Slices.

They are based on the frozen P0 Scope and P0 Business Rules.

## Contract documents

1. `01-ARCHITECTURE.md`
   - Overall system structure
   - Technology stack
   - Frontend / backend / database responsibilities
   - Main communication paths

2. `02-DOMAIN_MODEL.md`
   - Core P0 domain entities
   - Entity meanings
   - Relationships between entities

3. `03-AUTH_CONTRACT.md`
   - Authentication approach
   - Authorization rules
   - Owner / Member access boundaries

4. `04-DATABASE_CONTRACT.md`
   - Database conventions
   - Primary keys and foreign keys
   - Unique constraints
   - Deletion rules
   - Prisma migration rules
   - Concurrent update requirements

5. `05-REST_API_CONTRACT.md`
   - REST API naming conventions
   - Request / response conventions
   - HTTP status codes
   - Common error format
   - P0 shared API contracts

6. `06-REALTIME_CONTRACT.md`
   - WebSocket connection rules
   - Trip room strategy
   - Event naming conventions
   - Reconnection and synchronization rules

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
   - Contract and database change workflow

## Contract lifecycle

Each contract follows:

Draft → Team Review → Frozen

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

1. P0 Scope defines what P0 includes.
2. P0 Business Rules define how the product behaves.
3. These Technical Contracts define how the shared technical system supports those rules.

Feature implementations must follow the frozen contracts.

## Scope rule

These documents define shared technical boundaries only.

They should not prescribe private implementation details that affect only one Vertical Slice and do not create dependencies for other team members.
