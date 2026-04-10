import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TranscriptionRepository } from '../transcription.repository';
import { CacheService } from 'src/common/cache.service';

@Injectable()
export class TranscriptionEventsHandler {
    constructor(
        private readonly transcriptionRepository: TranscriptionRepository,
        private readonly cacheService: CacheService,
    ) { }

    @OnEvent('transcription.created')
    async handleTranscriptionCreated(event: any) {
        const { videoUrl, cacheKey, formatted, platform, ip } = event;
        try {
            await this.transcriptionRepository.create({
                transcript: formatted.transcript,
                utterances: formatted.utterances,
                metadata: formatted.metadata,
                ip,
            });
            await this.cacheService.set(cacheKey, formatted, 60 * 60 * 24); // 24 hours
        } catch (err) {
            // Optionally log error
        }
    }
}
