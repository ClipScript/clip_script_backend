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


    sendProgress(jobId: string, progress: number, type: 'download' | 'transcribe') {
        this.server.emit(`progress-${type}-${jobId}`, progress);
    }

    sendCompleted(jobId: string, data: any, type: 'download' | 'transcribe') {
        this.server.emit(`completed-${type}-${jobId}`, data);
    }

    sendError(jobId: string, message: string, type: 'download' | 'transcribe') {
        this.server.emit(`error-${type}-${jobId}`, message);
    }
}