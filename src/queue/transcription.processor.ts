import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { spawn } from 'child_process';
import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import { ProgressGateway } from 'src/gateways/progress.gateway';
import { TranscriptionService } from 'src/translate/translate.service';
import { Logger } from '@nestjs/common';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
// ffmpeg.setFfmpegPath('C:\\ffmpeg\\bin\\ffmpeg.exe');



@Processor('transcription')
export class TranscribeProcessor {
    private readonly logger = new Logger(TranscribeProcessor.name);

    constructor(
        private gateway: ProgressGateway,
        private transcriptionService: TranscriptionService,

    ) { }


    private getPlatform(url: string) {
        if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
        if (url.includes('tiktok.com')) return 'tiktok';
        if (url.includes('instagram.com')) return 'instagram';
        return 'unknown';
    }

    private buildYtDlpArgs(url: string, output: string) {
        const platform = this.getPlatform(url);

        const proxy = `http://${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`;

        const baseArgs = [
            '-o', output,
            '--no-playlist',
            '-f', 'bestaudio/best',
            '--extract-audio',
            '--audio-format', 'mp3',
            // '--proxy', proxy,

            // 🚀 SPEED BOOST
            '--concurrent-fragments', '5',
            '--throttled-rate', '100K',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

        ];

        if (platform === 'youtube') {
            return [
                ...baseArgs,
                // '--cookies', 'cookies.txt',
                '--js-runtimes', 'node',
                url,
            ];
        }

        if (platform === 'tiktok') {
            return [
                ...baseArgs,
                '--proxy', proxy,
                '--force-ipv4',
                '--add-header', 'Referer:https://www.tiktok.com/',
                url
            ];
        }

        if (platform === 'instagram') {
            return [
                ...baseArgs,
                // '--cookies', 'cookies.txt',
                '--proxy', proxy,
                '--force-ipv4',
                '--add-header', 'Referer:https://www.instagram.com/',
                url,
            ];
        }

        return [...baseArgs, url];
    }

    @Process('transcribe-job')
    async handle(job: Job) {
        const { videoUrl } = job.data;
        const jobId = job.id.toString();
        this.logger.log(`[${jobId}] Starting transcription for URL: ${videoUrl}`);

        try {
            this.gateway.sendProgress(jobId, 10, 'transcribe'); // started

            // const videoPath = await this.downloadVideo(videoUrl, jobId);
            // this.gateway.sendProgress(jobId, 30, 'transcribe');

            // const audioPath = await this.extractAudio(videoPath, jobId);
            // this.gateway.sendProgress(jobId, 50, 'transcribe');

            const audioPath = await this.downloadAudio(videoUrl, jobId);
            this.gateway.sendProgress(jobId, 30, 'transcribe');


            const transcript = await this.transcribeAudio(audioPath);
            this.gateway.sendProgress(jobId, 80, 'transcribe');

            const saveData = await this.transcriptionService.saveResult(job, transcript);
            console.log('Saved transcription data to DB:', saveData);
            this.gateway.sendProgress(jobId, 95, 'transcribe');

            this.gateway.sendCompleted(jobId, transcript, 'transcribe');

            // fs.unlinkSync(videoPath);
            fs.unlinkSync(audioPath);

            return transcript;
        } catch (err) {
            this.logger.error(`[${jobId}] Transcription failed: ${err.message}`, err.stack);
            this.gateway.sendError(jobId, 'Transcription failed', 'transcribe');
            throw err;
        }
    }



    async downloadAudio(url: string, jobId: string): Promise<string> {
        if (!url) {
            this.logger.error(`[${jobId}] No URL provided for audio download`);
            throw new Error('No URL provided');
        }
        this.logger.log(`[${jobId}] Starting audio download...`);
        this.logger.log(`[${jobId}] Downloading from URL: ${url}`);

        return new Promise((resolve, reject) => {
            const output = `downloads/${jobId}.mp3`;

            // ensure folder exists
            if (!fs.existsSync('downloads')) {
                fs.mkdirSync('downloads', { recursive: true });
            }

            const args = this.buildYtDlpArgs(url, output);

            const process = spawn('yt-dlp', args);

            // 🔥 LOG EVERYTHING (CRITICAL)
            process.stdout.on('data', (data) => {
                this.logger.log(`[${jobId}] yt-dlp: ${data}`);
            });

            process.stderr.on('data', (data) => {
                this.logger.error(`[${jobId}] yt-dlp error: ${data}`);
            });

            process.on('close', (code) => {
                if (code === 0 && fs.existsSync(output)) {
                    this.logger.log(`[${jobId}] Audio download finished`);
                    resolve(output);
                } else {
                    reject(new Error('Audio download failed'));
                }
            });

            process.on('error', reject);
        });
    }

    async downloadVideo(url: string, jobId: string): Promise<string> {
        this.logger.log(`[${jobId}] Starting video download...`);
        return new Promise((resolve, reject) => {
            const output = `downloads/${jobId}.mp4`;

            // const process = spawn('yt-dlp', [
            //     '-o', output,
            //     '--no-playlist',
            //     url,
            // ]);

            // const proxy = this.proxyService.getProxyByJob(jobId);

            const process = spawn('yt-dlp', [
                '-o',
                `downloads/${jobId}.mp4`,
                '--no-playlist',

                // '--proxy', proxy,

                '-f', 'bestvideo+bestaudio/best',

                // 🚀 SPEED BOOST
                '--concurrent-fragments', '5',

                //  THROTTLE BYPASS
                '--throttled-rate', '100K',

                '--user-agent',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

                '--add-header', 'Accept-Language:en-US,en;q=0.9',
                '--add-header', 'Referer:https://www.tiktok.com/',
                '--add-header', 'Accept:text/html,application/xhtml+xml',
                '--add-header', 'Connection:keep-alive',

                '--cookies', 'cookies.txt',

                '--no-check-certificate',
                '--restrict-filenames',

                url,
            ]);

            process.on('close', (code) => {
                if (code === 0) {
                    if (!fs.existsSync(output)) {
                        this.logger.error(`[${jobId}] File not found after download`);
                        return reject(new Error('File missing after download'));
                    }

                    this.logger.log(`[${jobId}] Video download finished`);
                    resolve(output);
                } else {
                    this.logger.error(`[${jobId}] Video download failed with code ${code}`);
                    reject(new Error('Download failed'));
                }
            });
            process.on('error', (err) => {
                this.logger.error(`[${jobId}] Error spawning yt-dlp: ${err.message}`);
                reject(err);
            });
        });
    }

    async extractAudio(videoPath: string, jobId: string): Promise<string> {
        this.logger.log(`[${jobId}] Extracting audio from video...`);
        return new Promise((resolve, reject) => {
            const audioPath = `downloads/${jobId}.mp3`;

            ffmpeg(videoPath)
                .noVideo()
                .audioCodec('libmp3lame')
                .save(audioPath)
                .on('end', () => {
                    this.logger.log(`[${jobId}] Audio extraction finished`);
                    resolve(audioPath);
                })
                .on('error', (err) => {
                    this.logger.error(`[${jobId}] Audio extraction failed: ${err.message}`);
                    reject(err);
                });
        });
    }

    async transcribeAudio(audioPath: string) {
        this.logger.log(`Uploading audio for transcription...`);
        const uploadUrl = await this.upload(audioPath);
        this.logger.log(`Audio uploaded: ${uploadUrl}`);

        this.logger.log(`Requesting transcript...`);
        const id = await this.requestTranscript(uploadUrl);
        this.logger.log(`Transcript requested, id: ${id}`);

        const result = await this.pollTranscript(id);

        const sentences = await this.getSentences(id);

        return {
            transcript: result.transcript,
            utterances: sentences,
        };
    }

    async upload(audioPath: string) {
        try {
            const res = await axios.post(
                'https://api.assemblyai.com/v2/upload',
                fs.createReadStream(audioPath),
                {
                    headers: {
                        authorization: process.env.ASSEMBLYAI_API_KEY,
                    },
                }
            );
            this.logger.log(`Audio uploaded to AssemblyAI`);
            return res.data.upload_url;
        } catch (err) {
            this.logger.error(`Audio upload failed: ${err.message}`);
            throw err;
        }
    }

    async requestTranscript(uploadUrl: string) {
        try {
            const res = await axios.post(
                'https://api.assemblyai.com/v2/transcript',
                {
                    audio_url: uploadUrl,
                    language_detection: "en",
                    speech_models: ["universal-3-pro", "universal-2"],
                    speaker_labels: true,
                },
                {
                    headers: {
                        authorization: process.env.ASSEMBLYAI_API_KEY,
                    },
                }
            );
            this.logger.log(`Transcript request sent to AssemblyAI`);
            return res.data.id;
        } catch (err) {
            this.logger.error(`Transcript request failed: ${err.message}`);
            throw err;
        }
    }

    async pollTranscript(id: string) {
        while (true) {
            try {
                const res = await axios.get(
                    `https://api.assemblyai.com/v2/transcript/${id}`,
                    {
                        headers: {
                            authorization: process.env.ASSEMBLYAI_API_KEY,
                        },
                    }
                );

                if (res.data.status === 'completed') {
                    this.logger.log(`Transcription completed successfully`);
                    return {
                        transcript: res.data.text,
                        transcriptId: id,
                    };
                }

                if (res.data.status === 'error') {
                    this.logger.error(`Transcription failed on AssemblyAI side`);
                    throw new Error('Transcription failed');
                }

                this.logger.log(`Transcription status: ${res.data.status}, polling again in 3s...`);
                await new Promise((r) => setTimeout(r, 3000));
            } catch (err) {
                this.logger.error(`Polling transcript failed: ${err.message}`);
                throw err;
            }
        }
    }


    async getSentences(transcriptId: string) {
        try {
            const res = await axios.get(
                `https://api.assemblyai.com/v2/transcript/${transcriptId}/sentences`,
                {
                    headers: {
                        authorization: process.env.ASSEMBLYAI_API_KEY,
                    },
                }
            );

            return res.data.sentences;
        } catch (err) {
            this.logger.error(`Fetching sentences failed: ${err.message}`);
            throw err;
        }
    }
}