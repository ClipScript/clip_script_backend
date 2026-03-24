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

            // const process = spawn('yt-dlp', [
            //     '-o',
            //     outputPath,
            //     videoUrl,
            // ]);

            const process = spawn('yt-dlp', [
                '-o',
                outputPath,
                '--merge-output-format', 'mp4',
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

                videoUrl,
            ]);



            process.stdout.on('data', (data) => {
                const message = data.toString();
                console.log(message);

                // ✅ Extract progress
                const progressMatch = message.match(/(\d+\.\d+)%/);
                if (progressMatch) {
                    const progress = parseFloat(progressMatch[1]);
                    this.gateway.sendProgress(jobId, progress, 'download');
                }


            });

            process.stderr.on('data', (data) => {
                console.error(data.toString());
            });

            process.on('close', (code) => {
                const finalFilePath = `downloads/${jobId}.mp4`;
                if (code === 0 && fs.existsSync(finalFilePath)) {
                    // ✅ store file
                    this.downloaderService.setFile(jobId, finalFilePath);

                    // ✅ generate safe API URL
                    const fileUrl = `${this.configService.get('BASE_URL')}/api/downloader/download/${jobId}`;

                    // ✅ notify frontend
                    this.gateway.sendCompleted(jobId, fileUrl, 'download');

                    resolve({ status: 'completed' });
                } else {
                    this.gateway.sendError(jobId, 'Download failed', 'download');
                    reject(new Error('Download failed'));
                }
            });
        });
    }
}