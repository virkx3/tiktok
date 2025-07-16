# Use the official Node image with Chromium dependencies
FROM node:20-slim

# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy your Node.js files
COPY package*.json ./
COPY bot.js ./  # make sure your script is named bot.js or update this

# Install dependencies
RUN npm install

# Puppeteer will download Chromium at runtime OR you can force install it now
ENV PUPPETEER_SKIP_DOWNLOAD=false
RUN npm install puppeteer

# Expose port (not really needed for bot, but Railway expects a listening port)
EXPOSE 3000

# Run the bot
CMD [ \"node\", \"bot.js\" ]
