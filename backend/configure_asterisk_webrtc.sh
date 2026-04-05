#!/bin/bash
# Run this script with sudo to enable WebRTC and SIP in Asterisk

echo "Configuring Asterisk http.conf for WebSockets..."
cat << 'EOF' > /etc/asterisk/http.conf
[general]
enabled=yes
bindaddr=127.0.0.1
bindport=8088
; We use 127.0.0.1 because the frontend is communicating locally
EOF

echo "Configuring Asterisk pjsip.conf for WebRTC Endpoint 1001..."
cat << 'EOF' > /etc/asterisk/pjsip.conf
; --- TRANSORTS ---
[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060

[transport-wss]
type=transport
protocol=ws
bind=127.0.0.1:8088

; --- WEBRTC ENDPOINT (Browser) ---
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
dtls_auto_generate_cert=yes
webrtc=yes
context=internal
disallow=all
allow=ulaw
allow=alaw
allow=opus
use_avpf=yes
media_encryption=dtls
dtls_verify=fingerprint
dtls_setup=actpass
ice_support=yes
media_use_received_transport=yes
rtcp_mux=yes
EOF

echo "Restarting Asterisk to apply changes..."
systemctl restart asterisk

echo "Done! Port 8088 should now be accepting ws://localhost:8088/ws connections."
