// transcription.controller.ts
import { Controller, Post, Body, Get, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { TranscriptionService } from './translate.service';
import { CreateTranscriptionDto } from './dto/create-translate.dto';
import type { Response, Request } from 'express';
import { Res, Req } from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { RecaptchaService } from '../common/recaptcha.service';

@Controller('transcription')
export class TranscriptionController {
    constructor(
        private readonly transcriptionService: TranscriptionService,
        private readonly recaptchaService: RecaptchaService,
    ) { }

    @Post()
    async createTranscription(@Body() dto: CreateTranscriptionDto, @Req() req: Request) {
        // CAPTCHA validation placeholder
        if (!dto.captchaToken) {
            throw new BadRequestException('CAPTCHA token is required');
        }
        const captchaValid = await this.recaptchaService.verify(dto.captchaToken);
        if (!captchaValid) {
            throw new BadRequestException('CAPTCHA verification failed');
        }
        let ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        if (Array.isArray(ip)) ip = ip[0];
        return this.transcriptionService.initiateTranscription(dto, ip);
    }

    @Get(':jobId/status')
    async getStatus(@Param('jobId') jobId: string) {
        return this.transcriptionService.getJobStatus(jobId);
    }

    // @Get(':jobId/result')
    // async getResult(@Param('jobId') jobId: string) {
    //     return this.transcriptionService.getJobResult(jobId);
    // }

    @Get('/recent')
    async getRecentTranscribesForIp() {
        console.log('Fetching recent transcriptions for IP');
        return this.transcriptionService.getRecentTranscribesForIp();
    }

    @Get(':id')
    async getTranscription(@Param('id') id: string) {
        console.log('Fetching transcription for job ID:', id);
        const result = await this.transcriptionService.getTranscription(id);
        console.log('Fetched transcription for job ID:', id, 'Result:', result);
        return result;
    }

    @Get(':jobId/download')
    async downloadVideo(
        @Param('jobId') jobId: string,
        @Req() req: Request,
        @Res() res: Response
    ) {
        console.log('Download request for job ID:', jobId, 'from IP:', req.ip);
        // Validate job ownership by IP
        const transcription = await this.transcriptionService.getTranscriptionByJobId(jobId);
        console.log('Transcription lookup result:', transcription);
        const videoPath = join(__dirname, '../../tmp', `${jobId}.mp4`);
        console.log('Resolved video path:', videoPath);
        const fileExists = existsSync(videoPath);
        console.log('File exists:', fileExists);
        if (!transcription) {
            return res.status(404).json({ message: 'Transcription not found.' });
        }
        // Optionally check IP
        // if (transcription.ip !== req.ip) {
        //     return res.status(403).json({ message: 'Unauthorized to download this video.' });
        // }
        // Locate video file
        if (!fileExists) {
            return res.status(404).json({ message: 'Video file not found.' });
        }
        // Stream video file
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="video_${jobId}.mp4"`);
        const stream = createReadStream(videoPath);
        stream.pipe(res);
    }
}