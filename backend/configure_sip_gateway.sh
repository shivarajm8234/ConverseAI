#!/bin/bash
# Adding GSM Gateway extension and Dialplan for outgoing routing

echo "Adding SIP Gateway (App) Endpoint 2000 to pjsip.conf..."
cat << 'EOF' >> /etc/asterisk/pjsip.conf

; --- ANDROID SMARTPHONE Gateway (App) ---
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
disallow=all
allow=ulaw
allow=alaw
; Webrtc options NOT needed here because the app uses standard SIP over UDP
EOF

echo "Setting up extensions.conf for outbound routing..."
cat << 'EOF' > /etc/asterisk/extensions.conf
[internal]
; A static test call (if 1001 calls 1000, it plays hello-world)
exten => 1000,1,Answer()
same => n,Playback(hello-world)
same => n,Hangup()

; Allow 1001 to ring 2000 directly
exten => 2000,1,Dial(PJSIP/2000)
same => n,Hangup()

; OUTBOUND ROUTING TO GSM:
; If WebRTC dials any number with 10 or more digits (e.g., 9620760023)
; Asterisk pushes the call to your Android App (Ext 2000)
exten => _XXXX.,1,NoOp(Dialing outbound number ${EXTEN} through Gateway 2000)
same => n,Dial(PJSIP/${EXTEN}@2000,60)
same => n,Hangup()
EOF

echo "Reloading Asterisk Dialplan and PJSIP..."
rasterisk -x 'dialplan reload'
rasterisk -x 'pjsip reload'

echo "Done! The PBX is ready to push calls to your SIP Gateway App."
