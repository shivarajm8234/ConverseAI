# Use Ubuntu 24.04 as base (Asterisk is not in Debian Bookworm repos)
FROM ubuntu:24.04

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# Install tzdata first to avoid timezone prompts blocking the install
RUN apt-get update && apt-get install -y tzdata 
# Install Asterisk and dependencies
# asterisk-modules includes pjsip, codec_opus, etc.
# ffmpeg is needed for media processing in AGI
# curl is used to install Node.js
RUN apt-get update && apt-get install -y \
    asterisk \
    asterisk-modules \
    ffmpeg \
    curl \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create necessary directories for the project
RUN mkdir -p /opt/converse/backend /var/lib/asterisk/agi-bin

# Set permissions so asterisk can read/write where needed
# Docker Desktop on Windows handles volume permissions specially, 
# but we set these as a baseline.
RUN chown -R asterisk:asterisk /var/lib/asterisk/agi-bin /opt/converse /etc/asterisk /var/log/asterisk

# The AGI script will be mounted/linked via docker-compose
# We ensure the asterisk user has a shell for AGI script execution if needed
RUN usermod -s /bin/bash asterisk

# Default ports:
# 5060: SIP UDP/TCP
# 8088: HTTP/WebRTC
# 10000-10100: RTP UDP (reduced range)
EXPOSE 5060/udp 5060/tcp 8088/tcp 10000-10100/udp

# Run Asterisk in the foreground
# -f: foreground
# -vvv: verbose
# -T: timestamp in logs
# -U asterisk: run as asterisk user
CMD ["/usr/sbin/asterisk", "-f", "-vvv", "-T", "-U", "asterisk"]
