FROM node:20-bookworm

# Install system dependencies including OpenSSL and Rust (required for curl-cffi compilation)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    python3.11 \
    python3.11-venv \
    python3-pip \
    python3.11-dev \
    ca-certificates \
    build-essential \
    libffi-dev \
    libssl-dev \
    pkg-config \
    libc-dev \
    libc6-dev \
    curl \
    git \
    # These are specifically needed for curl-cffi's TLS fingerprinting
    libcurl4-openssl-dev \
    openssl \
    libboringssl-dev 2>/dev/null || true && \
    update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

# Install Rust (curl-cffi needs it for compilation)
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Python packages - curl-cffi must be installed before yt-dlp[all]
RUN python3 -m pip install --upgrade pip --break-system-packages && \
    python3 -m pip install wheel setuptools --break-system-packages && \
    python3 -m pip install curl-cffi --break-system-packages && \
    python3 -m pip install 'yt-dlp[default]' --break-system-packages

# Verify impersonation targets are available
RUN yt-dlp --list-impersonate-targets

# Clean up build dependencies to reduce image size
RUN apt-get remove -y \
    build-essential \
    python3.11-dev \
    libffi-dev \
    libssl-dev \
    pkg-config \
    libc-dev \
    libc6-dev \
    libcurl4-openssl-dev \
    git && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* /root/.cargo/registry /root/.cargo/git

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npm install -g @nestjs/cli

COPY . .
COPY cookies.txt /app/cookies.txt

RUN npm run build
RUN npm prune --production
RUN mkdir -p /app/tmp

EXPOSE 3000
CMD ["npm", "run", "start:prod"]