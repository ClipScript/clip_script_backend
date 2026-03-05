# Use official Node.js LTS image
FROM node:20-bullseye

# Install Python 3.11, Chromium, and all dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        python3.11 \
        python3.11-venv \
        python3.11-distutils \
        python3.11-dev \
        ca-certificates \
        chromium \
        chromium-driver \
        build-essential \
        libffi-dev \
        libssl-dev \
        pkg-config \
        libc-dev \
        libc6-dev \
        libxml2-dev \
        libxslt1-dev \
        zlib1g-dev \
        libbrotli-dev && \
    update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 && \
    python3 --version && \
    python3 -m pip install --upgrade pip && \
    python3 -m pip install 'yt-dlp[tiktok]' && \
    apt-get remove -y build-essential python3.11-dev libffi-dev libssl-dev pkg-config libc-dev libc6-dev libxml2-dev libxslt1-dev zlib1g-dev libbrotli-dev && \
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
