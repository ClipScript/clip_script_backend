FROM node:20-bookworm

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
    curl \
    git \
    libcurl4-openssl-dev \
    openssl && \
    update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

# Bootstrap pip for python3.11 explicitly
RUN python3.11 -m ensurepip --upgrade && \
    python3.11 -m pip install --upgrade pip --break-system-packages

# Install Rust
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"

# Verify Rust
RUN rustc --version && cargo --version

# Install build tools
RUN python3.11 -m pip install wheel setuptools --break-system-packages

# Install curl-cffi
RUN python3.11 -m pip install curl-cffi --break-system-packages

# Install yt-dlp
RUN python3.11 -m pip install 'yt-dlp[default]' --break-system-packages

# Make yt-dlp available on PATH
RUN ln -sf /usr/local/bin/yt-dlp /usr/bin/yt-dlp

# Verify everything works
RUN python3.11 -c "import curl_cffi; print('curl-cffi OK:', curl_cffi.__version__)"
RUN yt-dlp --list-impersonate-targets | grep -i chrome

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