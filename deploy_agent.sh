#!/bin/bash
# Deploy agent_eagi.js to system Asterisk (AGI + RECORD on Debian; EAGI fd3 if res_eagi loaded).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Deploying AI agent to system Asterisk..."

if ! systemctl is-active --quiet asterisk 2>/dev/null; then
  echo "❌ Asterisk service is not running. Run: sudo systemctl start asterisk"
  echo "   Or run ./master_setup.sh once."
  exit 1
fi

echo "🔨 Building backend..."
(cd backend && npm run build)

DIST="backend/dist/agent_eagi.js"
AGI_BIN="/var/lib/asterisk/agi-bin"
BACKEND_DIR="$SCRIPT_DIR/backend"

if [ ! -f "$DIST" ]; then
  echo "❌ Missing $DIST"
  exit 1
fi

echo "📦 Installing agent + configs..."
sudo install -m 0755 -o root -g asterisk "$DIST" "$AGI_BIN/agent_eagi.js"
sudo install -m 0644 -o root -g root "$SCRIPT_DIR/asterisk_config/extensions.conf" /etc/asterisk/extensions.conf
# Keep SIP/RTP in sync so phones registered as 2000 use context=internal and can dial 3000 → AI agent.
for f in pjsip.conf rtp.conf http.conf; do
  if [ -f "$SCRIPT_DIR/asterisk_config/$f" ]; then
    sudo install -m 0644 -o root -g root "$SCRIPT_DIR/asterisk_config/$f" "/etc/asterisk/$f"
  fi
done

echo '{"type":"module"}' | sudo tee "$AGI_BIN/package.json" > /dev/null
sudo ln -sfn "$BACKEND_DIR/node_modules" "$AGI_BIN/node_modules"
sudo mkdir -p /opt/converse
sudo ln -sfn "$BACKEND_DIR" /opt/converse/backend
sudo chown -R asterisk:asterisk "$AGI_BIN"

chmod o+rX "$BACKEND_DIR" 2>/dev/null || true
chmod o+r "$BACKEND_DIR/.env" 2>/dev/null || true
chmod -R o+rX "$BACKEND_DIR/node_modules" 2>/dev/null || true

echo "🔄 Reloading Asterisk config..."
sudo asterisk -rx "pjsip reload"
sudo asterisk -rx "dialplan reload"

echo "✅ Deployment complete."
echo ""
echo "Phone → AI agent: register as 2000 / 5678 @ <this PC LAN IP>:5060 UDP, then dial 3000."
echo "Verify registration:  sudo asterisk -rx \"pjsip show endpoint 2000\""
echo "Full steps:            asterisk_config/PORTSIP_SETUP.txt"
