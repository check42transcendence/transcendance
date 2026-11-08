import {
	WebSocketGateway,
	WebSocketServer,
	SubscribeMessage,
	ConnectedSocket,
	MessageBody,
	type OnGatewayInit,
	Ack,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { Server, Socket } from 'socket.io'
import { RealtimeAuthService } from './realtime-auth.service.js';
import { TripMembershipAccessService } from './trip-membership-access.service.js';

import type {
  TripSubscriptionPayload,
  SubscriptionAck,
} from '@tripcollab/shared';

type AckCallback = (response: SubscriptionAck) => void;

@WebSocketGateway({
	path: '/socket.io',
})
export class TripGateway implements OnGatewayInit {
	@WebSocketServer()
	server!: Server;
	constructor(
		private readonly realtimeAuth: RealtimeAuthService,
		private readonly membershipAccess: TripMembershipAccessService,
	) {}

	afterInit(server: Server): void {
		server.use(async (socket, next) => {
			try {
				const userId = await this.realtimeAuth.authenticate(
				socket.handshake.headers.cookie,
				);
				socket.data.userId = userId;
				next();
			} catch {
				next(new Error('Authentication required'));
			}
		});
	}

	@SubscribeMessage('trip:subscribe')
	async subscribe(
		@ConnectedSocket() socket: Socket,
		@MessageBody() payload: TripSubscriptionPayload,
		@Ack() ack:AckCallback | undefined,
	): Promise<void> {

		const tripId = payload?.tripId;
		if (typeof tripId !== 'string' || !isUUID(tripId)) {
			ack?.({ok: false});
			return ;
		}

		const userId: unknown = socket.data.userId;
		if (typeof userId !== 'string' || !isUUID(userId)) {
			ack?.({ ok: false });
			return;
		}

		try {
			const allowed = await this.membershipAccess.canSubscribe(
				userId,
				tripId,
			);
			if (!allowed || !socket.connected) {
				ack?.({ ok: false });
				return ;
			}

			const room = `trip:${tripId}`;
			await socket.join(room);
			const stillAllowed = socket.connected &&
				await this.membershipAccess.canSubscribe(userId, tripId);

			if (!stillAllowed) {
				await socket.leave(room);
				ack?.({ ok: false });
				return;
			}
			if (!socket.connected) {
				await socket.leave(room);
				ack?.({ ok: false });
				return ;
			}
			ack?.({ ok: true });
		} catch {
			ack?.({ ok: false})
		}
	}

	@SubscribeMessage('trip:unsubscribe')
	async unsubscribe(
		@ConnectedSocket() socket: Socket,
		@MessageBody() payload: TripSubscriptionPayload,
		@Ack() ack: AckCallback | undefined,
	): Promise<void> {
		
		const tripId = payload?.tripId;
		if (typeof tripId !== 'string' || !isUUID(tripId)) {
			ack?.({ok: false});
			return ;
		}
		try {
			await socket.leave(`trip:${tripId}`);
			ack?.({ ok: true });
		} catch {
			ack?.({ ok: false });
		}
	}
}