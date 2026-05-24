FROM node:22-bookworm-slim

# Install Chromium system libs
RUN apt-get update && apt-get install -y \
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
    libpango-1.0-0 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install HyperFrames CLI and ffmpeg-static
RUN npm install -g hyperframes ffmpeg-static

# Symlink ffmpeg to /usr/local/bin
RUN ln -sf $(npm root -g)/ffmpeg-static/ffmpeg /usr/local/bin/ffmpeg

# Download chrome-headless-shell at build time
RUN npx hyperframes browser ensure

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
