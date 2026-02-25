# Use official Node.js LTS image
FROM node:18-slim

# Install ffmpeg and yt-dlp (latest)
RUN apt-get update && \
    apt-get install -y ffmpeg wget && \
    wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/bin/yt-dlp && \
    chmod +x /usr/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Install NestJS CLI globally for build
RUN npm install -g @nestjs/cli

# Copy the rest of your app
COPY . .

# Copy cookies.txt into the image (for yt-dlp authentication)
COPY cookies.txt /app/cookies.txt

# Build the app (if using TypeScript)
RUN npm run build

# Remove dev dependencies for production
RUN npm prune --production

# Create tmp directory for video/audio files
RUN mkdir -p /app/tmp

# Expose the port your NestJS app runs on
EXPOSE 3000

# Start the app
CMD ["npm", "run", "start:prod"]
