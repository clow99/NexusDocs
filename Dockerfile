# Stage 1: Build the Next.js app
FROM ubuntu:24.04 AS builder

# Install Node.js and sendmail
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates sendmail \
    && rm -rf /var/cache/apt/archives/* \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ENV http_proxy=$HTTP_PROXY \
    https_proxy=$HTTPS_PROXY \
    no_proxy=$NO_PROXY \
    HTTP_PROXY=$HTTP_PROXY \
    HTTPS_PROXY=$HTTPS_PROXY \
    NO_PROXY=$NO_PROXY

WORKDIR /app
COPY package.json package-lock.json ./
# Improve npm resilience and optionally honor proxies
RUN npm config set registry https://registry.npmjs.org/ \
 && npm config set fetch-retries 5 \
 && npm config set fetch-retry-factor 2 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fetch-retry-mintimeout 20000 \
 && if [ -n "$HTTP_PROXY" ]; then npm config set proxy "$HTTP_PROXY"; fi \
 && if [ -n "$HTTPS_PROXY" ]; then npm config set https-proxy "$HTTPS_PROXY"; fi \
 && npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# Stage 2: Production image with pm2, nginx, and sendmail
FROM ubuntu:24.04

# Install Node.js, pm2, nginx, and sendmail
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY
ENV http_proxy=$HTTP_PROXY \
    https_proxy=$HTTPS_PROXY \
    no_proxy=$NO_PROXY \
    HTTP_PROXY=$HTTP_PROXY \
    HTTPS_PROXY=$HTTPS_PROXY \
    NO_PROXY=$NO_PROXY

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=America/Toronto
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates sendmail tzdata cron \
    && rm -rf /var/cache/apt/archives/* \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs nginx \
    && npm install -g pm2 \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo "$TZ" > /etc/timezone \
    && dpkg-reconfigure -f noninteractive tzdata \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

# Copy the Next.js build from the builder stage
WORKDIR /app
COPY --from=builder /app ./

# Remove the default Nginx configuration
RUN rm /etc/nginx/sites-available/default \
    && rm /etc/nginx/sites-enabled/default

# Copy the custom Nginx configuration
COPY ./default.conf /etc/nginx/sites-available/default
RUN ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Copy scripts and make them executable
COPY ./scripts/cron-scans.sh /usr/local/bin/cron-scans.sh
COPY ./scripts/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/cron-scans.sh /usr/local/bin/start.sh

# Create log file for cron
RUN touch /var/log/cron-scans.log

# Expose the application port
EXPOSE 80

# Use the startup script which configures cron and starts all services
CMD ["/usr/local/bin/start.sh"]
