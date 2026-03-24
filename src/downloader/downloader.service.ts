import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { CreateTranscriptionDto } from '../translate/dto/create-translate.dto';
import { RedisService } from 'src/common/redis.service';

@Injectable()
export class DownloaderService {
  constructor(
    @InjectQueue('video-download') private readonly videoQueue: Queue,
    private readonly redisService: RedisService,
  ) { }

  private downloadsMap = new Map<string, string>();

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

  async setFile(jobId: string, path: string) {
    await this.redisService.set(`download:${jobId}`, path);
  }

  async getFile(jobId: string) {
    return this.redisService.get(`download:${jobId}`);
  }

  async removeFile(jobId: string) {
    await this.redisService.del(`download:${jobId}`);
  }
}