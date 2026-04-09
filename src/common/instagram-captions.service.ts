import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import { parseVTT } from './utils/vtt-parser';
import { TranscriptResult } from './interfaces/transcript.interface';

@Injectable()
export class InstagramCaptionsService {
    private readonly logger = new Logger(InstagramCaptionsService.name);

    async extract(url: string): Promise<TranscriptResult | null> {
        return new Promise((resolve) => {
            const output = `downloads/instagram-captions.%(ext)s`;
            const args = [
                '--skip-download',
                '--write-auto-sub',
                '--sub-format',
                'vtt',
                '-o',
                output,
                url,
            ];
            const process = spawn('yt-dlp', args);
            process.on('close', () => {
                const file = fs
                    .readdirSync('downloads')
                    .find((f) => f.includes('instagram-captions') && f.endsWith('.vtt'));
                if (!file) return resolve(null);
                const content = fs.readFileSync(`downloads/${file}`, 'utf-8');
                const parsed = parseVTT(content);
                const filteredUtterances = (parsed.sentences || []).filter(u => u.text && u.text.trim());
                fs.unlinkSync(`downloads/${file}`);
                resolve({
                    transcript: parsed.text,
                    utterances: filteredUtterances,
                    source: 'captions',
                });
            });
            process.on('error', () => resolve(null));
        });
    }
}
