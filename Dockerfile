FROM node:20-bookworm

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    python3.11 \
    python3.11-venv \
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
    rm -rf /var/lib/apt/lists/*

# Create a virtualenv - this gives us a clean pip with no Debian restrictions
RUN python3.11 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Verify pip works inside venv
RUN pip install --upgrade pip

# Install Rust (required for curl-cffi compilation)
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"

# Verify Rust
RUN rustc --version && cargo --version

# Install packages inside venv - no --break-system-packages needed
RUN pip install wheel setuptools
RUN pip install curl-cffi
RUN pip install 'yt-dlp[default]'

# Symlink yt-dlp so it's available system-wide
RUN ln -sf /opt/venv/bin/yt-dlp /usr/local/bin/yt-dlp

# Verify curl-cffi and impersonation work
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