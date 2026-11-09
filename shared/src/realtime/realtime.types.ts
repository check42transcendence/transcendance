import type { Activity } from '../api/activities.types.js';

export type UUID = string;
export type ISODateTime = string;

// Every server-to-client domain event uses this envelope.
export interface RealtimeEnvelope<T> {
  tripId: UUID;
  occurredAt: ISODateTime;
  data: T;
}

// Client-to-server subscription protocol.
export interface TripSubscriptionPayload {
  tripId: UUID;
}

export type SubscriptionAck =
  | { ok: true }
  | { ok: false };

// The seven event names defined by the realtime contract.
export type RealtimeEventName =
  | 'activity:created'
  | 'activity:updated'
  | 'activity:deleted'
  | 'proposal:created'
  | 'proposal:vote-updated'
  | 'proposal:adopted'
  | 'proposal:reopened';

// Activity payloads are fully typed here.
// Proposal payload types belong to the Proposal/shared-types work.
export interface ActivityRealtimeEventData {
  'activity:created': {
    activity: Activity;
  };

  'activity:updated': {
    activity: Activity;
  };

  'activity:deleted': {
    activityId: UUID;
    reopenedProposalId: UUID | null;
  };
}

export type ActivityRealtimeEventName =
  keyof ActivityRealtimeEventData;

export type ActivityRealtimePayload<
  K extends ActivityRealtimeEventName,
> = RealtimeEnvelope<ActivityRealtimeEventData[K]>;

export type ActivityServerToClientEvents = {
  [K in ActivityRealtimeEventName]: (
    event: ActivityRealtimePayload<K>,
  ) => void;
};
