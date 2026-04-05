#!/bin/bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
ASTERISK_CONFIG_DIR="$PROJECT_ROOT/asterisk_config"
AGI_BIN_DIR="/var/lib/asterisk/agi-bin"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
DIST_AGENT="$BACKEND_DIR/dist/agent_eagi.js"
LEGACY_CONTAINER="asterisk"

echo "🚀 CONVERSE AI: END-TO-END MASTER SETUP (native Asterisk) 🚀"
echo "   Project root: $PROJECT_ROOT"

# 0. Remove old Docker Asterisk if present (no longer used)
echo "🧹 0/8: Stopping legacy Asterisk Docker container (if any)..."
sudo docker rm -f "$LEGACY_CONTAINER" 2>/dev/null || true

# 1. INSTALL SYSTEM PREREQUISITES (no Docker)
echo "🔨 1/8: Installing Asterisk, Node, ffmpeg..."
sudo apt-get update -y
# asterisk-modules is still useful for extra codecs; Debian Asterisk often ships without res_eagi (use AGI+RECORD in agent).
sudo apt-get install -y asterisk asterisk-modules nodejs npm ffmpeg curl

if [ ! -f /etc/asterisk/asterisk.conf ]; then
  echo "⚠️  /etc/asterisk/asterisk.conf missing — reinstalling asterisk package files..."
  sudo apt-get install -y --reinstall asterisk asterisk-modules
fi

# 2. INSTALL PROJECT MODULES & BUILD
echo "📦 2/8: Installing dependencies & building backend + frontend..."
cd "$PROJECT_ROOT"
[ -f package.json ] && npm install
cd "$BACKEND_DIR"
npm install
npm run build
cd "$FRONTEND_DIR"
[ -f package.json ] && npm install
cd "$PROJECT_ROOT"

if [ ! -f "$DIST_AGENT" ]; then
  echo "❌ Build failed: $DIST_AGENT not found. Fix backend errors and re-run."
  exit 1
fi

# 3. PREPARE ASTERISK CONFIGURATION (project copy, then install to /etc/asterisk)
echo "⚙️ 3/8: Generating Asterisk configuration files..."
mkdir -p "$ASTERISK_CONFIG_DIR"

sudo tee "$ASTERISK_CONFIG_DIR/pjsip.conf" > /dev/null << 'EOF'
[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060

[transport-wss]
type=transport
protocol=ws
bind=0.0.0.0:8088

[2000]
type=aor
max_contacts=1
remove_existing=yes

[2000]
type=auth
auth_type=userpass
username=2000
password=5678

[2000]
type=endpoint
aors=2000
auth=2000
context=internal
direct_media=no
disallow=all
allow=ulaw,alaw

[1001]
type=aor
max_contacts=1
remove_existing=yes

[1001]
type=auth
auth_type=userpass
username=1001
password=1234

[1001]
type=endpoint
aors=1001
auth=1001
webrtc=yes
context=internal
disallow=all
allow=ulaw,alaw,opus
media_encryption=dtls
dtls_auto_generate_cert=yes
dtls_verify=fingerprint
dtls_setup=actpass
ice_support=yes
use_avpf=yes
media_use_received_transport=yes
rtcp_mux=yes
EOF

sudo tee "$ASTERISK_CONFIG_DIR/extensions.conf" > /dev/null << 'EOF'
[internal]
; AI Agent — AGI() for Debian/apt Asterisk (no res_eagi). Use EAGI() only with a build that provides res_eagi.so.
exten => 3000,1,Answer()
same => n,Wait(1)
same => n,AGI(/var/lib/asterisk/agi-bin/agent_eagi.js)
same => n,Hangup()

; Call Mobile Extension
exten => 2000,1,Dial(PJSIP/2000)
same => n,Hangup()

; Call WebRTC Extension
exten => 1001,1,Dial(PJSIP/1001)
same => n,Hangup()
EOF

sudo tee "$ASTERISK_CONFIG_DIR/http.conf" > /dev/null << 'EOF'
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8088
EOF

sudo tee "$ASTERISK_CONFIG_DIR/rtp.conf" > /dev/null << 'EOF'
[general]
rtpstart=10000
rtpend=20000
EOF

echo "📋 Installing configs under /etc/asterisk/ (backups: .bak before overwrite)..."
for f in pjsip.conf extensions.conf http.conf rtp.conf; do
  if [ -f "/etc/asterisk/$f" ]; then
    sudo cp -a "/etc/asterisk/$f" "/etc/asterisk/$f.bak.$(date +%s)" || true
  fi
  sudo install -m 0644 -o root -g root "$ASTERISK_CONFIG_DIR/$f" "/etc/asterisk/$f"
done

# 4. Stable path for AGI (.env lists /opt/converse/backend/.env in agent_eagi)
echo "🔗 4/8: Linking /opt/converse/backend → project backend (for .env + APIs)..."
sudo mkdir -p /opt/converse
sudo ln -sfn "$BACKEND_DIR" /opt/converse/backend

# 5. AGI agent (ESM: package.json in agi-bin)
echo "🤖 5/8: Installing AI agent into $AGI_BIN_DIR ..."
sudo install -d -o root -g asterisk -m 0755 "$AGI_BIN_DIR"
echo '{"type":"module"}' | sudo tee "$AGI_BIN_DIR/package.json" > /dev/null
sudo install -m 0755 -o root -g asterisk "$DIST_AGENT" "$AGI_BIN_DIR/agent_eagi.js"
sudo ln -sfn "$BACKEND_DIR/node_modules" "$AGI_BIN_DIR/node_modules"

if [ ! -f "$BACKEND_DIR/.env" ]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  echo "⚠️  Created backend/.env from .env.example — add GROQ_API_KEY and other secrets."
fi

echo "🔓 5b: Permissions so user asterisk can read backend + node_modules..."
chmod o+rX "$BACKEND_DIR" 2>/dev/null || true
chmod o+r "$BACKEND_DIR/.env" 2>/dev/null || true
chmod -R o+rX "$BACKEND_DIR/node_modules" 2>/dev/null || true
sudo chown -R asterisk:asterisk "$AGI_BIN_DIR"

# 6. Enable & start Asterisk
echo "▶️  6/8: Enabling Asterisk service..."
sudo systemctl enable asterisk
sudo systemctl restart asterisk

if ! sudo systemctl is-active --quiet asterisk; then
  echo "❌ Asterisk failed to start. Check: sudo journalctl -u asterisk -n 40 --no-pager"
  exit 1
fi

# CLI + control socket: use sudo, or add your user to group asterisk and re-login
if [ -n "${SUDO_USER:-}" ] && id "$SUDO_USER" &>/dev/null; then
  sudo usermod -aG asterisk "$SUDO_USER"
  echo "👤 Added $SUDO_USER to group 'asterisk' (log out/in to use asterisk -r without sudo)."
fi

echo "⏳ Waiting for Asterisk..."
for _ in $(seq 1 45); do
  if sudo asterisk -rx "core show version" &>/dev/null; then
    break
  fi
  sleep 1
done

# 7. Reload modules / dialplan
echo "🔑 7/8: Reloading dialplan & PJSIP..."
sudo asterisk -rx "dialplan reload"
sudo asterisk -rx "module reload res_pjsip.so" 2>/dev/null || true

# 8. SUMMARY
PRIMARY_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'this-host')"
echo "=========================================================="
echo "✅ END-TO-END DEPLOYMENT COMPLETE (system Asterisk, no Docker)"
echo ""
echo "📱 CONNECT TO MOBILE GATEWAY:"
echo "   App (Zoiper/Linphone)  -> Extension: 2000 | Pass: 5678"
echo "   Server URL             -> $PRIMARY_IP"
echo ""
echo "🎙️ TALK TO SHRUTI (AI):"
echo "   Dial 3000 from your phone"
echo ""
echo "💻 START DASHBOARD (from project root):"
echo "   npm run dev"
echo ""
echo "📋 AGI log: sudo tail -50 /tmp/agent_debug.log"
echo "📋 Asterisk CLI: sudo asterisk -rvvv   (not plain asterisk — needs root or group asterisk)"
echo "📋 If SIP dead: ./scripts/asterisk_up.sh"
echo "=========================================================="
