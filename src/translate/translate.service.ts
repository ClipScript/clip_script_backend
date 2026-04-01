// transcription.service.ts
import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { CreateTranscriptionDto as CreateTranscriptionDto } from './dto/create-translate.dto';
import { TranscriptionRepository } from './transcription.repository';
import type { Request } from 'express';
import type { Job } from 'bull';

@Injectable()
export class TranscriptionService {
    constructor(
        @InjectQueue('transcription') private transcriptionQueue: Queue,
        private readonly transcriptionRepository: TranscriptionRepository,
        @Inject('REQUEST') private readonly request: Request,
    ) { }

    async initiateTranscription(dto: CreateTranscriptionDto, ip: string) {
        // Validate URL and platform
        const platform = this.detectPlatform(dto.videoUrl);

        if (!platform) {
            throw new BadRequestException('Unsupported platform');
        }

        // Add job to queue
        try {
            const job = await this.transcriptionQueue.add({
                videoUrl: dto.videoUrl,
                ip,
                platform,
            }, {
                attempts: 2,
                backoff: 5000, // 5 seconds
            });
            return {
                jobId: job.id,
                status: 'queued',
            };
        } catch (error) {
            console.error('Error adding job to queue:', error);
            throw new BadRequestException('Failed to add job to queue');
        }
    }

    private detectPlatform(url: string): string | null {
        if (url.includes('tiktok.com')) return 'tiktok';
        if (url.includes('instagram.com')) return 'instagram';
        if (url.includes('youtube.com/shorts') || url.includes('youtu.be')) return 'youtube';
        return null;
    }

    async getJobStatus(jobId: string) {
        const job = await this.transcriptionQueue.getJob(jobId);

        if (!job) {
            throw new NotFoundException('Job not found');
        }


        const state = await job.getState();
        const progress = job.progress();

        return {
            jobId: job.id,
            status: state,
            progress,
        };
    }

    async saveResult(job: Job, transcript: { transcript: string, utterances?: any[] }) {
        const jobId = String(job.id);

        console.log(`Saving result for job ${jobId}...`);

        let transcriptDoc = await this.transcriptionRepository.findByJobId(jobId);

        if (!transcriptDoc) {
            const { ip, platform, videoUrl } = job.data;

            let utterances: any[] = [];

            // ✅ map sentences → utterances
            if (transcript?.utterances && Array.isArray(transcript.utterances)) {
                utterances = transcript.utterances.map((s: any) => ({
                    text: s.text,
                    start: s.start,
                    end: s.end,
                }));
            }

            transcriptDoc = await this.transcriptionRepository.create({
                transcript: transcript?.transcript || '',
                ip,
                jobId,
                platform,
                videoUrl,
                utterances,
            });
        }

        return transcriptDoc;
    }

    async getRecentTranscribesForIp() {
        let ip = this.request.ip || this.request.headers['x-forwarded-for'] || 'unknown';
        if (Array.isArray(ip)) ip = ip[0];
        return this.transcriptionRepository.findByIp(ip);
    }

    async getTranscription(id: string) {
        return this.transcriptionRepository.fetchByJobId(id);
    }

    async getTranscriptionByJobId(id: string) {
        return this.transcriptionRepository.findByJobId(id);
    }

}