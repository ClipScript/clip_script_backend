import { Injectable } from '@nestjs/common';
import { Supadata } from '@supadata/js';



@Injectable()
export class SupadataService {
    private readonly supadata: Supadata;

    constructor() {
        const apiKey = process.env.SD_API_KEY;
        if (!apiKey) {
            throw new Error('SD_API_KEY environment variable is required');
        }
        this.supadata = new Supadata({ apiKey });
    }

    // Fetch transcript with exponential backoff polling if needed
    async fetchTranscriptWithPolling(videoUrl: string) {
        const transcriptResult = await this.supadata.transcript({
            url: videoUrl,
            text: false, // Returns timed segments
            mode: 'auto', // Required for IG/TikTok fallback
        });

        if ('jobId' in transcriptResult) {
            let jobResult;
            let attempt = 0;
            let delay = 2000; // Start with 2 seconds
            const maxDelay = 15000; // Cap at 15 seconds
            const maxTotalWait = 180000; // 3 minutes max total wait
            let totalWait = 0;

            do {
                await new Promise(res => setTimeout(res, delay));
                totalWait += delay;
                jobResult = await this.supadata.transcript.getJobStatus(transcriptResult.jobId);
                attempt++;
                delay = Math.min(delay * 2, maxDelay); // Exponential backoff, capped
            } while (jobResult.status !== 'completed' && jobResult.status !== 'failed' && totalWait < maxTotalWait);

            if (jobResult.status === 'completed') {
                return jobResult.content;
            } else if (jobResult.status === 'failed') {
                throw new Error(jobResult.error || 'Transcript job failed');
            } else {
                throw new Error('Transcript polling timed out');
            }
        } else {
            // For smaller files, we get the transcript directly
            return transcriptResult.content;
        }
    }

    // Fetch Metadata using direct call
    async fetchMetadata(videoUrl: string) {
        return await this.supadata.metadata({ url: videoUrl });
    }

    // Fetch transcript and metadata sequentially with rate limiting
    async fetchTranscriptAndMetadata(videoUrl: string) {
        const transcript = await this.fetchTranscriptWithPolling(videoUrl);
        // Wait 1 second before making the next request to respect rate limit
        await new Promise(res => setTimeout(res, 1000));
        const metadata = await this.fetchMetadata(videoUrl);
        return { transcript, metadata };
    }
}
