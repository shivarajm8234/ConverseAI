#!/usr/bin/env bash
# Fix "Unable to open asterisk.conf" / "asterisk.ctl" when you ran `asterisk -r` without sudo or the daemon is down.
set -euo pipefail
echo "== systemctl =="
sudo systemctl start asterisk
sudo systemctl --no-pager -l status asterisk || true
echo ""
echo "== CLI (always works) =="
echo "  sudo asterisk -rvvv"
echo ""
echo "== Without sudo (after group add, log out and back in) =="
echo "  sudo usermod -aG asterisk \"\$USER\""
echo "  # then new session:  asterisk -rvvv"
echo ""
sudo asterisk -rx "core show version" 2>/dev/null || echo "Still failing — see: sudo journalctl -u asterisk -n 50"

echo ""
echo "== Extension 3000 — stock Debian has no res_eagi; dialplan should use AGI() (see extensions.conf) =="
sudo asterisk -rx "module show like res_eagi" 2>/dev/null | head -5 || true
echo "Check dialplan:  sudo asterisk -rx \"dialplan show 3000@internal\""
echo "Optional EAGI:    ./scripts/ensure_eagi_module.sh"

if command -v ufw >/dev/null 2>&1 && sudo ufw status 2>/dev/null | grep -qi "Status: active"; then
  echo ""
  echo "== UFW is on — SIP may be blocked =="
  echo "  sudo ufw allow 5060/udp"
  echo "  sudo ufw allow 10000:20000/udp"
fi
