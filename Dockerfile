FROM node:22-bookworm-slim

# Chromium runtime libs. Match what chrome-headless-shell needs on Debian.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libwayland-client0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    wget \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies (includes hyperframes + ffmpeg-static from package.json)
COPY package*.json ./
RUN npm install --no-audit --no-fund \
  && ln -sf /app/node_modules/ffmpeg-static/ffmpeg /usr/local/bin/ffmpeg \
  && /usr/local/bin/ffmpeg -version

# Pre-download chrome-headless-shell so first render doesn't pay for it.
RUN npx --no-install hyperframes browser ensure

# Copy source code
COPY . .

# Expose port for API
EXPOSE 8000

# Start the API server
CMD ["node", "server.js"]
