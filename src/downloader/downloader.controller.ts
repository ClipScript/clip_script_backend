import { Controller, Post, Body, Logger, BadRequestException } from '@nestjs/common';
import { DownloaderService } from './downloader.service';
import { RecaptchaService } from 'src/common/recaptcha.service';
import { CreateTranscriptionDto } from '../translate/dto/create-translate.dto';

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
}
