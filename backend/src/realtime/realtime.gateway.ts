import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('join-show')
  handleJoinShow(client: Socket, showId: string) {
    client.join(`show:${showId}`);
  }

  @SubscribeMessage('leave-show')
  handleLeaveShow(client: Socket, showId: string) {
    client.leave(`show:${showId}`);
  }
}
