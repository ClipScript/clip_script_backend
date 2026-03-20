import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { CreateTranscriptionDto } from '../translate/dto/create-translate.dto';

@Injectable()
export class DownloaderService {
    constructor(
        @InjectQueue('video-download') private readonly videoQueue: Queue,
    ) { }

    async downloadVideoOnly(dto: CreateTranscriptionDto) {
        const { videoUrl } = dto;

        // Add job to queue
        const job = await this.videoQueue.add('download-job', {
            videoUrl,
        }, {
            attempts: 3,
            backoff: 5000,
        });

        return {
            message: 'Download started',
            jobId: job.id,
        };
    }
}