import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);


@Processor('transcription')
export class TranscriptionProcessor {
    private readonly logger = new Logger(TranscriptionProcessor.name);

    private get ytDlpPath(): string {
        return process.platform === 'win32'
            ? path.join(__dirname, '../../bin/yt-dlp.exe')
            : '/usr/local/bin/yt-dlp';
    }

    private get cookiesPath(): string {
        return process.platform === 'win32'
            ? path.join(__dirname, '../../cookies.txt')
            : '/app/cookies.txt';
    }

    private async runCommand(cmd: string, timeoutMs = 120_000): Promise<string> {
        try {
            const { stdout, stderr } = await execAsync(cmd, { timeout: timeoutMs });
            if (stderr) this.logger.warn(`stderr: ${stderr}`);
            return stdout;
        } catch (err) {
            throw new Error(err.message || String(err));
        }
    }

    private buildTikTokFlags(): string {
        return [
            '--impersonate chrome',
            '--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"',
            '--add-header "Referer:https://www.tiktok.com/"',
            '--add-header "Accept-Language:en-US,en;q=0.9"',
        ].join(' ');
    }

    private buildYouTubeFlags(): string {
        const proxyUrl = process.env.PROXY_URL;
        return [
            '--extractor-args "youtube:player_client=web,android"',
            '--compat-options no-youtube-unavailable-videos',
            '--retries 5',
            '--retry-sleep exp=2:30',
            '--sleep-requests 2',
            '--sleep-interval 5',
            '--max-sleep-interval 15',
            proxyUrl ? `--proxy "${proxyUrl}"` : '',
        ].filter(Boolean).join(' ');
    }

    @Process('process-video')
    async handleTranscription(job: Job) {
        const { videoUrl } = job.data;

        // --- Setup temp dir ---
        const tempDir = path.resolve(__dirname, '../../tmp');
        fs.mkdirSync(tempDir, { recursive: true });
        this.logger.log(`Temp dir: ${tempDir}`);

        const isTikTok = videoUrl.includes('tiktok.com');
        const isYouTube = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');

        const platformFlags = isTikTok
            ? this.buildTikTokFlags()
            : isYouTube
                ? this.buildYouTubeFlags()
                : '';

        const base = `${this.ytDlpPath} ${platformFlags} --cookies "${this.cookiesPath}"`;
        const audioPath = path.join(tempDir, `${job.id}.mp3`);

        // ─── 1. Download Audio Only ──────────────────────────────────────────
        this.logger.log(`Downloading audio only → ${audioPath}`);

        const audioStrategies = isTikTok
            ? [
                // Strategy 1: standard audio extraction
                `${base} -x --audio-format mp3 --audio-quality 0 -o "${audioPath}" "${videoUrl}"`,
                // Strategy 2: drop impersonation, rely only on cookies
                `${this.ytDlpPath} --cookies "${this.cookiesPath}" -x --audio-format mp3 -o "${audioPath}" "${videoUrl}"`,
                // Strategy 3: no cookies, no flags — last resort
                `${this.ytDlpPath} -x --audio-format mp3 -o "${audioPath}" "${videoUrl}"`,
            ]
            : [
                `${base} -x --audio-format mp3 --audio-quality 0 -o "${audioPath}" "${videoUrl}"`,
                `${base} -f "ba/b" -x --audio-format mp3 -o "${audioPath}" "${videoUrl}"`,
            ];

        let lastError: Error | null = null;
        for (let i = 0; i < audioStrategies.length; i++) {
            this.logger.log(`Audio download — attempt ${i + 1}/${audioStrategies.length}`);
            try {
                await this.runCommand(audioStrategies[i]);
                this.logger.log(`Audio download succeeded on attempt ${i + 1}`);
                break;
            } catch (err) {
                lastError = err;
                this.logger.warn(`Audio download attempt ${i + 1} failed: ${err.message}`);
                if (i === audioStrategies.length - 1) {
                    throw lastError ?? new Error('Audio download failed after all attempts');
                }
            }
        }

        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file missing after download: ${audioPath}`);
        }

        // ─── 2. Upload to AssemblyAI ─────────────────────────────────────────
        const apiKey = process.env.ASSEMBLYAI_API_KEY;
        if (!apiKey) throw new Error('Missing ASSEMBLYAI_API_KEY');

        let audioUrl: string;
        try {
            const uploadRes = await axios.post(
                'https://api.assemblyai.com/v2/upload',
                fs.createReadStream(audioPath),
                { headers: { authorization: apiKey, 'transfer-encoding': 'chunked' } }
            );
            this.logger.log(`Audio upload response: ${JSON.stringify(uploadRes.data)}`);
            audioUrl = uploadRes.data.upload_url;
            this.logger.log(`Audio uploaded: ${audioUrl}`);
        } catch (err) {
            throw new Error(`Audio upload failed: ${err.response?.data?.error ?? err.message}`);
        }

        // ─── 3. Submit Transcript Job ────────────────────────────────────────
        let transcriptId: string;
        try {
            const transcriptRes = await axios.post(
                'https://api.assemblyai.com/v2/transcript',
                {
                    audio_url: audioUrl,
                    language_detection: "en",
                    speech_models: ["universal-3-pro", "universal-2"],
                },
                { headers: { authorization: apiKey } }
            );
            transcriptId = transcriptRes.data.id;
            this.logger.log(`Transcript job submitted: ${transcriptId}`);
        } catch (err) {
            throw new Error(`Transcript submission failed: ${err.response?.data?.error ?? err.message}`);
        }

        // ─── 4. Poll for Completion ──────────────────────────────────────────
        let transcriptText = '';
        let transcriptSentences = [];

        const maxPolls = 120; // 6 minutes max (120 × 3s)
        for (let i = 0; i < maxPolls; i++) {
            const statusRes = await axios.get(
                `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
                { headers: { authorization: apiKey } }
            );

            const { status, text, error } = statusRes.data;

            this.logger.log(`Polling transcript status: ${status} (attempt ${i + 1}/${maxPolls})`);

            if (status === 'completed') {
                transcriptText = text;
                try {
                    const sentencesRes = await axios.get(
                        `https://api.assemblyai.com/v2/transcript/${transcriptId}/sentences`,
                        { headers: { authorization: apiKey } }
                    );
                    transcriptSentences = sentencesRes.data.sentences ?? [];
                } catch (err) {
                    this.logger.warn('Failed to fetch sentences, continuing without them');
                }
                break;
            } else if (status === 'error') {
                throw new Error(`AssemblyAI transcription error: ${error}`);
            }

            await new Promise((r) => setTimeout(r, 3000));
        }

        if (!transcriptText) {
            this.logger.error('Transcription polling timed out or never completed.');
            throw new Error('Transcription polling timed out or never completed.');
        }

        // ─── 5. Cleanup — delete audio ───────────────────────────────────────
        try {
            fs.unlinkSync(audioPath);
            this.logger.log(`Deleted audio: ${audioPath}`);
        } catch {
            this.logger.warn(`Could not delete audio file: ${audioPath}`);
        }

        // ─── 6. Return transcript ────────────────────────────────────────────
        this.logger.log(`Transcript text: ${transcriptText}`);
        return { returnvalue: transcriptText, utterances: transcriptSentences };
    }
}
