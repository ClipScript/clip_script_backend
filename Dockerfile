# Use official Node.js LTS image
FROM node:18-slim

# Install ffmpeg (and wget if needed for other purposes)
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Install system and Python build dependencies for yt-dlp[tiktok]
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        python3 \
        python3-pip \
        python3-wheel \
        build-essential \
        python3-dev \
        libffi-dev \
        libssl-dev \
        pkg-config \
        libc-dev \
        libc6-dev \
        libxml2-dev \
        libxslt1-dev \
        zlib1g-dev \
        libbrotli-dev && \
    rm -rf /var/lib/apt/lists/*

# Upgrade pip separately
RUN pip3 install --upgrade pip

# Install yt-dlp with TikTok dependencies separately for easier debugging
RUN pip3 install 'yt-dlp[tiktok]'

# Remove build dependencies after yt-dlp install
RUN apt-get remove -y build-essential python3-dev libffi-dev libssl-dev pkg-config libc-dev libc6-dev libxml2-dev libxslt1-dev zlib1g-dev libbrotli-dev python3-wheel && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

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
