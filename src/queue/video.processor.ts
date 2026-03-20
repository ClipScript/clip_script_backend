import { spawn } from 'child_process';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { ProgressGateway } from 'src/gateways/progress.gateway';
import { DownloaderService } from 'src/downloader/downloader.service';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';


@Processor('video-download')
export class VideoProcessor {
    constructor(
        private gateway: ProgressGateway,
        private downloaderService: DownloaderService,
        private configService: ConfigService,
    ) { }

    @Process('download-job')
    async handleDownload(job: Job) {
        const { videoUrl } = job.data;
        const jobId = job.id.toString();

        // ✅ Ensure downloads folder exists
        if (!fs.existsSync('downloads')) {
            fs.mkdirSync('downloads');
        }

        return new Promise((resolve, reject) => {
            // ✅ Use jobId as filename (production-safe)
            const outputPath = `downloads/${jobId}.%(ext)s`;

            const process = spawn('yt-dlp', [
                '-o',
                outputPath,
                videoUrl,
            ]);

            let finalFilePath: string | null = null;

            process.stdout.on('data', (data) => {
                const message = data.toString();
                console.log(message);

                // ✅ Extract progress
                const progressMatch = message.match(/(\d+\.\d+)%/);
                if (progressMatch) {
                    const progress = parseFloat(progressMatch[1]);
                    this.gateway.sendProgress(jobId, progress);
                }

                // ✅ Extract destination file
                const destMatch = message.match(/Destination:\s(.+)/);
                if (destMatch) {
                    finalFilePath = destMatch[1].trim();
                }
            });

            process.stderr.on('data', (data) => {
                console.error(data.toString());
            });

            process.on('close', (code) => {
                if (code === 0 && finalFilePath) {
                    // ✅ store file
                    this.downloaderService.setFile(jobId, finalFilePath);

                    // ✅ generate safe API URL
                    const fileUrl = `${this.configService.get('BASE_URL')}/api/downloader/download/${jobId}`;

                    // ✅ notify frontend
                    this.gateway.sendCompleted(jobId, fileUrl);

                    resolve({ status: 'completed' });
                } else {
                    this.gateway.sendError(jobId, 'Download failed');
                    reject(new Error('Download failed'));
                }
            });
        });
    }
}