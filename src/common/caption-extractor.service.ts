import { Injectable } from '@nestjs/common';
import { YoutubeCaptionsService } from './youtube-captions.service';
import { TikTokCaptionsService } from './tiktok-captions.service';
import { InstagramCaptionsService } from './instagram-captions.service';
import { TranscriptResult } from './interfaces/transcript.interface';

@Injectable()
export class CaptionExtractorService {
    constructor(
        private youtubeService: YoutubeCaptionsService,
        private tiktokService: TikTokCaptionsService,
        private instagramService: InstagramCaptionsService,
    ) { }

    private getPlatform(url: string) {
        if (url.includes('youtube')) return 'youtube';
        if (url.includes('tiktok')) return 'tiktok';
        if (url.includes('instagram')) return 'instagram';
        return 'unknown';
    }

    async extract(url: string): Promise<TranscriptResult | null> {
        const platform = this.getPlatform(url);
        if (platform === 'youtube') {
            return await this.youtubeService.extract(url);
        }
        if (platform === 'tiktok') {
            return await this.tiktokService.extract(url);
        }
        if (platform === 'instagram') {
            return await this.instagramService.extract(url);
        }
        return null;
    }
}
