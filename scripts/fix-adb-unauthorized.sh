#!/usr/bin/env bash
# Fixes ADB "unauthorized" / RSA pairing for Android (tested layout for Vivo + Linux).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RULE_SRC="$ROOT/scripts/51-android-vivo-adb.rules"
RULE_DST="/etc/udev/rules.d/51-android-vivo-adb.rules"

echo "=== 1) udev rule (needs sudo; avoids 'no permissions' after you authorize) ==="
if [[ -f "$RULE_SRC" ]]; then
  sudo cp "$RULE_SRC" "$RULE_DST"
  sudo udevadm control --reload-rules
  sudo udevadm trigger
  echo "Installed $RULE_DST"
else
  echo "Skip: $RULE_SRC not found"
fi

if ! groups "$USER" | grep -q plugdev; then
  echo ""
  echo "=== Adding user to plugdev (logout/login after) ==="
  sudo usermod -aG plugdev "$USER" || true
fi

echo ""
echo "=== 2) Restart ADB on this PC ==="
adb kill-server 2>/dev/null || true
sleep 1
adb start-server
adb devices -l

echo ""
echo "=== 3) ON THE PHONE (required — cannot be done from the PC) ==="
echo "  • Unlock the screen."
echo "  • Developer options → USB debugging ON."
echo "  • Vivo: also turn ON any 'USB debugging (Security settings)' / install via USB if listed."
echo "  • USB mode: File transfer (MTP), not 'Charge only'."
echo "  • Unplug USB, plug back in."
echo "  • When a dialog 'Allow USB debugging?' appears → tap ALLOW (check 'Always allow' if shown)."
echo "  • If no dialog: Developer options → Revoke USB debugging authorizations → unplug/replug."
echo ""
echo "Then run:  adb devices"
echo "You want:  13938560810018K    device"
echo "Not:       unauthorized"
echo ""
