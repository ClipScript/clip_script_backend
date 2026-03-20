import { Controller, Post, Body, Logger, BadRequestException, Get, Param, NotFoundException, Res } from '@nestjs/common';
import { DownloaderService } from './downloader.service';
import { RecaptchaService } from 'src/common/recaptcha.service';
import { CreateTranscriptionDto } from '../translate/dto/create-translate.dto';
import * as fs from 'fs';
import type { Response } from 'express';

@Controller('downloader')
export class DownloaderController {
    private readonly logger = new Logger(DownloaderController.name);

    constructor(
        private readonly downloaderService: DownloaderService,
        private readonly recaptchaService: RecaptchaService,
    ) { }

    @Post('/download')
    async downloadVideo(@Body() dto: CreateTranscriptionDto) {
        if (!dto.captchaToken) {
            throw new BadRequestException('CAPTCHA token is required');
        }
        const captchaValid = await this.recaptchaService.verify(dto.captchaToken);
        console.log('the verification result', captchaValid)
        if (!captchaValid) {
            throw new BadRequestException('CAPTCHA verification failed');
        }
        return this.downloaderService.downloadVideoOnly(dto);
    }


    @Get('/download/:jobId')
    async downloadFile(@Param('jobId') jobId: string, @Res() res: Response) {
        const filePath = this.downloaderService.getFile(jobId);

        if (!filePath || !fs.existsSync(filePath)) {
            throw new NotFoundException('File not found');
        }

        return res.download(filePath, 'clip_script.mp4', (err) => {
            if (!err) {
                // ✅ delete after successful download
                fs.unlinkSync(filePath);
                this.downloaderService.removeFile(jobId);
            }
        });
    }
}
