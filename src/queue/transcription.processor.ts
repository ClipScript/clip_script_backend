import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { exec } from 'child_process';


@Processor('transcription')
export class TranscriptionProcessor {
    private readonly logger = new Logger(TranscriptionProcessor.name);

    @Process('process-video')
    async handleTranscription(job: Job) {
        const { videoUrl } = job.data;
        // Use absolute path for tmp directory
        const tempDir = path.resolve(__dirname, '../../tmp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
            this.logger.log(`Created tmp directory at: ${tempDir}`);
        } else {
            this.logger.log(`Using tmp directory at: ${tempDir}`);
        }

        // Set cookies path based on OS
        const cookiesPath = process.platform === 'win32'
            ? path.join(__dirname, '../../cookies.txt')
            : '/app/cookies.txt';

        // 1. Download original video using yt-dlp (best quality)
        const videoPath = path.join(tempDir, `${job.id}.mp4`);
        this.logger.log(`Video will be saved to: ${videoPath}`);
        const ytDlpPath = process.platform === 'win32'
            ? path.join(__dirname, '../../bin/yt-dlp.exe')
            : '/usr/local/bin/yt-dlp';
        const ytDlpVideoCmd = `${ytDlpPath} --cookies "${cookiesPath}" -f best -o "${videoPath}" "${videoUrl}"`;
        this.logger.log(`yt-dlp video command: ${ytDlpVideoCmd}`);
        try {
            await new Promise((resolve, reject) => {
                exec(ytDlpVideoCmd, (error, stdout, stderr) => {
                    this.logger.log('yt-dlp video stdout:', stdout);
                    this.logger.log('yt-dlp video stderr:', stderr);
                    if (error) {
                        this.logger.error(`yt-dlp video error: ${error.message}`);
                        reject(error);
                    } else {
                        this.logger.log('yt-dlp video download complete');
                        resolve(true);
                    }
                });
            });
            // Check if video file exists after yt-dlp completes
            if (fs.existsSync(videoPath)) {
                this.logger.log(`Video file exists after yt-dlp: ${videoPath}`);
            } else {
                this.logger.warn(`Video file does NOT exist after yt-dlp: ${videoPath}`);
            }
        } catch (err) {
            this.logger.error('Failed to download video with yt-dlp', err);
            this.logger.warn(`Video download failed for jobId ${job.id}. Video will not be available for download.`);
            // Continue processing so transcription can still work
        }

        // 2. Download audio using yt-dlp and ffmpeg (Linux-compatible)
        const audioPath = path.join(tempDir, `${job.id}.mp3`);
        this.logger.log(`Audio will be saved to: ${audioPath}`);
        const ytDlpCmd = `${ytDlpPath} --cookies "${cookiesPath}" -x --audio-format mp3 --keep-video -o "${audioPath}" "${videoUrl}"`;
        this.logger.log(`yt-dlp command: ${ytDlpCmd}`);
        try {
            await new Promise((resolve, reject) => {
                exec(ytDlpCmd, (error, stdout, stderr) => {
                    this.logger.log('yt-dlp stdout:', stdout);
                    this.logger.log('yt-dlp stderr:', stderr);
                    if (error) {
                        this.logger.error(`yt-dlp error: ${error.message}`);
                        reject(error);
                    } else {
                        this.logger.log('yt-dlp audio download complete');
                        resolve(true);
                    }
                });
            });
        } catch (err) {
            this.logger.error('Failed to download audio with yt-dlp', err);
            throw new Error('Audio download failed');
        }

        // 3. Send audio to AssemblyAI (or other provider)
        const apiKey = process.env.ASSEMBLYAI_API_KEY;
        if (!apiKey) {
            this.logger.error('Missing AssemblyAI API key');
            throw new Error('Missing AssemblyAI API key');
        }
        let audioUrl: string;
        try {
            const audioData = fs.createReadStream(audioPath);
            const uploadRes = await axios.post(
                'https://api.assemblyai.com/v2/upload',
                audioData,
                { headers: { authorization: apiKey, 'transfer-encoding': 'chunked' } }
            );
            this.logger.log('AssemblyAI upload response:', uploadRes.data);
            audioUrl = uploadRes.data.upload_url;
            this.logger.log('Audio uploaded to AssemblyAI');
        } catch (err) {
            this.logger.error('Failed to upload audio to AssemblyAI', err.response?.data || err);
            throw new Error('Audio upload failed');
        }

        let transcriptId: string;
        try {
            this.logger.log('Submitting transcript job with:', { audio_url: audioUrl, utterances: true });
            const transcriptRes = await axios.post(
                'https://api.assemblyai.com/v2/transcript',
                { audio_url: audioUrl, speech_models: ["universal-3-pro"], language_detection: true, },
                { headers: { authorization: apiKey } }
            );
            this.logger.log('AssemblyAI transcript response:', transcriptRes.data);
            transcriptId = transcriptRes.data.id;
            this.logger.log(`Transcript job submitted: ${transcriptId}`);
        } catch (err) {
            this.logger.error('Failed to submit transcript job', err.response?.data || err);
            throw new Error('Transcript job submission failed');
        }

        // 4. Poll for transcript completion
        let transcriptText = '';
        let transcriptUtterances = [];
        let transcriptSentences = [];

        try {
            while (true) {
                const statusRes = await axios.get(
                    `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
                    { headers: { authorization: apiKey } }
                );
                if (statusRes.data.status === 'completed') {
                    transcriptText = statusRes.data.text;
                    // Fetch sentences from AssemblyAI
                    try {
                        const sentencesRes = await axios.get(
                            `https://api.assemblyai.com/v2/transcript/${transcriptId}/sentences`,
                            { headers: { authorization: apiKey } }
                        );
                        transcriptSentences = sentencesRes.data.sentences || [];
                        break; // Exit loop after fetching sentences
                    } catch (sentenceErr) {
                        this.logger.error('Failed to fetch transcript sentences', sentenceErr.response?.data || sentenceErr);
                    }
                    // this.logger.log('Transcription completed');
                    // return { text: transcriptText, utterances: transcriptUtterances, sentences: transcriptSentences };
                }
                if (statusRes.data.status === 'failed') {
                    this.logger.error('Transcription failed', statusRes.data);
                    throw new Error('Transcription failed');
                }
                await new Promise((r) => setTimeout(r, 5000));
            }
        } catch (err) {
            this.logger.error('Error while polling for transcript', err);
            throw new Error('Transcript polling failed');
        }

        // 5. Clean up temp files
        try {
            fs.unlinkSync(audioPath);
            this.logger.log(`Audio file deleted: ${audioPath}`);
            // Do NOT delete video file after processing, so downloads work on both development and production
            // If you want to clean up old videos, implement a scheduled cleanup or manual deletion
        } catch (err) {
            this.logger.warn('Failed to clean up temp files', err);
        }

        // Log existence of both files after cleanup
        this.logger.log(`After cleanup: video exists? ${fs.existsSync(videoPath)}, audio exists? ${fs.existsSync(audioPath)}`);

        // 6. Return transcript
        // this.logger.log('Transcribed text:', transcriptText);
        // this.logger.log('Transcribed utterances:', transcriptUtterances);
        return { returnvalue: transcriptText, utterances: transcriptSentences };
    }
}
