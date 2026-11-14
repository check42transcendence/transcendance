import { Injectable } from '@nestjs/common';

import type {
	RealtimeEnvelope,
	RealtimeEventName,
	ActivityRealtimeEventName,
	ActivityRealtimeEventData,
} from '@tripcollab/shared';

import { TripGateway } from './trip.gateway.js';

@Injectable()
export class RealtimeService {
	constructor(
		private readonly gateway: TripGateway,
	) {}
	private roomName(tripId: string): string {
		return `trip:${tripId}`;
	}

	 /**
   * General server-to-client broadcast interface.
   *
   * The caller must invoke this only after the
   * relevant database transaction has committed.
   *
   * Event names are restricted to the realtime contract.
   * Proposal payload typing will be integrated with #50/#62.
   */
  emitToTrip<T>(
	tripId: string,
	eventName: RealtimeEventName,
	data: T,
  ): void {
	const payload: RealtimeEnvelope<T> = {
		tripId,
		occurredAt: new Date().toISOString(),
		data,
	};
	this.gateway.server
		.to(this.roomName(tripId))
		.emit(eventName, payload);
  }

   /**
   * Strictly typed Activity broadcast.
   *
   * Prevents sending the wrong data shape for an
   * Activity event.
   */
  emitActivityToTrip<K extends ActivityRealtimeEventName>(
	tripId: string,
	eventName: K,
	data: ActivityRealtimeEventData[K],
  ): void {
	this.emitToTrip(tripId, eventName, data);
  }

    /**
   * Remove every socket belonging to one user
   * from a particular Trip room.
   *
   * Other users and other Trip rooms are unaffected.
   */
  async removeUserFromTrip(
	userId: string,
	tripId: string,
  ): Promise<void> {
	const room = this.roomName(tripId);
	const sockets = await this.gateway.server
					.in(room)
					.fetchSockets();

	for (const socket of sockets) {
		if (socket.data.userId == userId) {
			await Promise.resolve(socket.leave(room));
			}	
		}
	}
	 /**
   * Remove all sockets from one Trip room.
   *
   * Intended for successful Trip deletion.
   */
	async removeTripRoom(
		tripId: string,
	): Promise<void> {
		const room = this.roomName(tripId);

		this.gateway.server
			.in(room)
			.socketsLeave(room);
	}
}