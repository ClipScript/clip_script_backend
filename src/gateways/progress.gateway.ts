import {
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
    cors: true,
})
export class ProgressGateway {
    @WebSocketServer()
    server: Server;


    sendProgress(jobId: string, progress: number) {
        this.server.emit(`progress-${jobId}`, progress);
    }

    sendCompleted(jobId: string, file: string) {
        this.server.emit(`completed-${jobId}`, file);
    }

    sendError(jobId: string, error: string) {
        this.server.emit(`error-${jobId}`, error);
    }
}