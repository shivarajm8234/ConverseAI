#!/usr/bin/env bash
# Debian/Ubuntu Asterisk 22 often ships WITHOUT res_eagi.so (only res_agi.so).
# This project uses AGI() + RECORD FILE in agent_eagi.js when fd 3 is absent — no EAGI module required.
set -euo pipefail

echo "Checking for res_eagi.so (optional; stock Debian usually has none)..."
FOUND=""
for dir in /usr/lib/x86_64-linux-gnu/asterisk/modules /usr/lib/aarch64-linux-gnu/asterisk/modules /usr/lib/asterisk/modules; do
  if [ -f "$dir/res_eagi.so" ]; then
    FOUND="$dir/res_eagi.so"
    break
  fi
done

if [ -n "$FOUND" ]; then
  echo "Found: $FOUND — loading..."
  sudo asterisk -rx "module load res_eagi.so" 2>/dev/null || sudo asterisk -rx "module load $FOUND"
  sudo asterisk -rx "module show like eagi" || true
  echo "You may use EAGI() in dialplan for lower latency; AGI() still works with RECORD fallback."
  exit 0
fi

echo ""
echo "No res_eagi.so in Asterisk modules (normal for Debian/Ubuntu packages)."
echo "VoiceAI uses AGI(/var/lib/asterisk/agi-bin/agent_eagi.js) + RECORD FILE — ensure extensions.conf has AGI() not EAGI() for exten 3000."
echo ""
echo "Next:  cd backend && npm run build && cd .. && ./deploy_agent.sh"
echo "       sudo cp asterisk_config/extensions.conf /etc/asterisk/ && sudo asterisk -rx 'dialplan reload'"
exit 0
