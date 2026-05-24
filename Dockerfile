FROM node:22-slim

# Install FFmpeg and shared library deps for chrome-headless-shell
RUN apt-get update && apt-get install -y \
    ffmpeg \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    ca-certificates \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install HyperFrames CLI globally (includes @puppeteer/browsers)
RUN npm install -g hyperframes

# Install chrome-headless-shell (required for HeadlessExperimental.beginFrame)
# Regular chromium lacks this API and causes window.__hf to never be ready.
RUN npx @puppeteer/browsers install chrome-headless-shell@stable

# Find and symlink the chrome-headless-shell binary
RUN CHROME_PATH=$(find /root/.cache/puppeteer -name 'chrome-headless-shell' -type f 2>/dev/null | head -1) && \
    if [ -n "$CHROME_PATH" ]; then \
        ln -sf "$CHROME_PATH" /usr/local/bin/chrome-headless-shell; \
    else \
        echo "chrome-headless-shell not found"; \
        exit 1; \
    fi

ENV HYPERFRAMES_BROWSER_PATH=/usr/local/bin/chrome-headless-shell

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port for API
EXPOSE 8000

# Start the API server
CMD ["node", "server.js"]
