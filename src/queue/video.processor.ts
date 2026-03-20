import { spawn } from 'child_process';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { ProgressGateway } from 'src/gateways/progress.gateway';

@Processor('video-download')
export class VideoProcessor {
    constructor(private gateway: ProgressGateway) { }

    @Process('download-job')
    async handleDownload(job: Job) {
        const { videoUrl } = job.data;
        const jobId = job.id.toString();

        return new Promise((resolve, reject) => {
            const process = spawn('yt-dlp', [
                '-o',
                'downloads/%(id)s.%(ext)s',
                videoUrl,
            ]);

            process.stdout.on('data', (data) => {
                const message = data.toString();
                console.log(message);

                // 🔥 Extract progress %
                const match = message.match(/(\d+\.\d+)%/);

                if (match) {
                    const progress = parseFloat(match[1]);
                    console.log("EMITTING:", jobId, progress);
                    // ✅ Emit to frontend
                    this.gateway.sendProgress(jobId, progress);
                }
            });

            process.stderr.on('data', (data) => {
                console.error(data.toString());
            });

            process.on('close', (code) => {
                if (code === 0) {
                    this.gateway.sendCompleted(jobId, 'download complete');

                    resolve({ status: 'completed' });
                } else {
                    this.gateway.sendError(jobId, 'Download failed');

                    reject(new Error('Download failed'));
                }
            });
        });
    }
}