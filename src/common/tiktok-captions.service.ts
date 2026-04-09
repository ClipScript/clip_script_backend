import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { TranscriptResult } from './interfaces/transcript.interface';
import * as fs from 'fs';
import { parseVTT } from './utils/vtt-parser'; // Adjust the import based on the actual parser used

@Injectable()
export class TikTokCaptionsService {
    private readonly logger = new Logger(TikTokCaptionsService.name);

    async extract(url: string): Promise<TranscriptResult | null> {
        return new Promise((resolve) => {
            const args = [
                '--skip-download',
                '--write-sub',
                '--sub-format',
                'json',
                url,
            ];
            const process = spawn('yt-dlp', args);
            let output = '';
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            process.on('close', () => {
                try {
                    const file = fs
                        .readdirSync('downloads')
                        .find((f) => f.includes('tiktok-captions') && f.endsWith('.vtt'));
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
                } catch {
                    resolve(null);
                }
            });
            process.on('error', () => resolve(null));
        });
    }
}
