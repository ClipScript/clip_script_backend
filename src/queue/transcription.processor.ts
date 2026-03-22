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

    @Process('transcribe-job')
    async handle(job: Job) {
        const { videoUrl } = job.data;
        const jobId = job.id.toString();

        try {
            this.gateway.sendProgress(jobId, 10, 'transcribe'); // started

            const videoPath = await this.downloadVideo(videoUrl, jobId);
            this.gateway.sendProgress(jobId, 30, 'transcribe');

            const audioPath = await this.extractAudio(videoPath, jobId);
            this.gateway.sendProgress(jobId, 50, 'transcribe');


            const transcript = await this.transcribeAudio(audioPath);
            this.gateway.sendProgress(jobId, 80, 'transcribe');

            const saveData = await this.transcriptionService.saveResult(job, transcript);
            console.log('Saved transcription data to DB:', saveData);
            this.gateway.sendProgress(jobId, 95, 'transcribe');

            this.gateway.sendCompleted(jobId, transcript, 'transcribe');

            fs.unlinkSync(videoPath);
            fs.unlinkSync(audioPath);

            return transcript;
        } catch (err) {
            this.logger.error(`[${jobId}] Transcription failed: ${err.message}`, err.stack);
            this.gateway.sendError(jobId, 'Transcription failed', 'transcribe');
            throw err;
        }
    }

    async downloadVideo(url: string, jobId: string): Promise<string> {
        this.logger.log(`[${jobId}] Starting video download...`);
        return new Promise((resolve, reject) => {
            const output = `downloads/${jobId}.mp4`;

            const process = spawn('yt-dlp', [
                '-o', output,
                '--no-playlist',
                url,
            ]);

            process.on('close', (code) => {
                if (code === 0) {
                    this.logger.log(`[${jobId}] Video download finished`);
                    resolve(output);
                } else {
                    this.logger.error(`[${jobId}] Video download failed with code ${code}`);
                    reject('Download failed');
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