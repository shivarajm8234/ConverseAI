import { useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Phone,
    PhoneCall,
    PhoneIncoming,
    PhoneOutgoing,
    Mic,
    Clock,
    ShieldCheck,
    PhoneOff,
    Wifi
} from 'lucide-react';
import { UserAgent, Inviter, SessionState } from 'sip.js';
import type { UserAgentOptions } from 'sip.js';
import { ParticleCard, GlobalSpotlight, useMobileDetection } from '@/components/ui/MagicBento';
import { apiUrl } from '@/lib/api';

const BLUE_GLOW = '0, 149, 255';

export function Calls() {
    const gridRef = useRef<HTMLDivElement>(null);
    const isMobile = useMobileDetection();

    const getStoredIp = () => localStorage.getItem('converse_pbx_ip') || '10.155.237.157';

    /** CRM-style label only — not used as SIP dial string */
    const [originalNumber, setOriginalNumber] = useState('');
    /** Must be a real Asterisk extension in [internal], e.g. 3000 = AI agent */
    const [targetNumber, setTargetNumber] = useState('3000');
    const [pbxLocalIp, setPbxLocalIp] = useState(getStoredIp());
    const [pbxWebsocketIp, setPbxWebsocketIp] = useState(window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname);

    useEffect(() => {
        localStorage.setItem('converse_pbx_ip', pbxLocalIp);
    }, [pbxLocalIp]);

    const { data: calls, isLoading } = useQuery({
        queryKey: ['calls-history'],
        queryFn: async () => {
            const res = await fetch(apiUrl('/calls'));
            if (!res.ok) throw new Error('Network error');
            return await res.json();
        }
    });

    const [sipStatus, setSipStatus] = useState('Disconnected');
    const [session, setSession] = useState<any>(null);
    const userAgentRef = useRef<UserAgent | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    const connectSIP = () => {
        setSipStatus('Connecting...');
        const uri = UserAgent.makeURI(`sip:1001@${pbxWebsocketIp}`);
        if (!uri) return;

        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

        const options: UserAgentOptions = {
            authorizationUsername: '1001',
            authorizationPassword: '1234',
            uri: uri,
            transportOptions: {
                server: `${wsProtocol}://${pbxWebsocketIp}:8088/ws`, // Asterisk WSS/WS Endpoint
            },
        };

        const ua = new UserAgent(options);

        ua.start().then(() => {
            setSipStatus('Connected (WebRTC)');
            userAgentRef.current = ua;
        }).catch((error: Error) => {
            setSipStatus(`Failed: ${error.message}`);
        });
    };

    const makeWebRTCCall = () => {
        if (!userAgentRef.current) {
            alert('Please connect to SIP first.');
            return;
        }

        const targetURI = UserAgent.makeURI(`sip:${targetNumber}@${pbxWebsocketIp}`);
        if (!targetURI) return;

        const inviter = new Inviter(userAgentRef.current, targetURI, {
            sessionDescriptionHandlerOptions: {
                constraints: { audio: true, video: false }
            }
        });

        inviter.stateChange.addListener((state: SessionState) => {
            if (state === SessionState.Established) {
                setSession(inviter);
                setSipStatus('In Call');

                // Attach remote audio
                const remoteStream = new MediaStream();
                const sdh = inviter.sessionDescriptionHandler as any;
                sdh?.peerConnection?.getReceivers().forEach((receiver: any) => {
                    if (receiver.track) remoteStream.addTrack(receiver.track);
                });

                if (audioRef.current) {
                    audioRef.current.srcObject = remoteStream;
                    audioRef.current.play();
                }
            } else if (state === SessionState.Terminated) {
                setSession(null);
                setSipStatus('Connected (WebRTC)');
                if (audioRef.current) audioRef.current.srcObject = null;
            }
        });

        inviter.invite().catch((error: Error) => {
            console.error("Failed to summon inviter:", error);
        });
    };

    const hangupCall = () => {
        if (session) {
            session.bye();
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 bento-section">
            <style>{`
        .bento-section {
          --glow-radius: 400px;
          --glow-color: ${BLUE_GLOW};
        }
        .live-pulse {
            animation: pulse-ring 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
        }
        @keyframes pulse-ring {
            0% { transform: scale(.33); }
            80%, 100% { opacity: 0; }
        }
      `}</style>

            <GlobalSpotlight
                gridRef={gridRef}
                spotlightRadius={400}
                glowColor={BLUE_GLOW}
                disableAnimations={isMobile}
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        <PhoneCall className="text-blue-500" />
                        AI Voice Center
                    </h1>
                    <p className="text-slate-400">Manage automated outbound dialing and inbound voice interactions.</p>
                </div>
            </div>

            <div ref={gridRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Active/New Call Control */}
                <div className="lg:col-span-1 space-y-6">
                    <ParticleCard
                        className="p-8 bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl"
                        glowColor={BLUE_GLOW}
                    >
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 bg-blue-500/20 rounded-xl">
                                <Mic className="text-blue-400" size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-white">Live Dialer</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs text-slate-500 uppercase font-bold tracking-wider ml-1">Note / CRM ID (optional)</label>
                                <input
                                    value={originalNumber}
                                    onChange={(e) => setOriginalNumber(e.target.value)}
                                    className="w-full p-4 bg-black/40 border border-blue-500/20 focus:border-blue-500/50 outline-none rounded-2xl text-white font-mono transition-all"
                                    placeholder="not sent to Asterisk"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-slate-500 uppercase font-bold tracking-wider ml-1">Extension to dial (WebRTC)</label>
                                <input
                                    value={targetNumber}
                                    onChange={(e) => setTargetNumber(e.target.value)}
                                    className="w-full p-4 bg-black/40 border border-blue-500/20 focus:border-blue-500/50 outline-none rounded-2xl text-white font-mono transition-all"
                                    placeholder="3000 = AI, 2000 = mobile, 1001 = WebRTC peer"
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    onClick={connectSIP}
                                    className="flex-1 flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-700/80 rounded-xl text-slate-300 font-bold transition-all text-sm border border-slate-700"
                                >
                                    <Wifi size={16} />
                                    Connect SIP
                                </button>
                            </div>

                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={makeWebRTCCall}
                                    disabled={sipStatus !== 'Connected (WebRTC)'}
                                    className="flex-1 group relative flex items-center justify-center gap-2 p-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-white font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:grayscale"
                                >
                                    <PhoneOutgoing size={18} fill="currentColor" />
                                    Dial (WebRTC)
                                    <div className="absolute inset-0 bg-emerald-400 blur-2xl opacity-0 group-hover:opacity-20 transition-opacity" />
                                </button>

                                <button
                                    onClick={hangupCall}
                                    disabled={!session}
                                    className="flex-1 group relative flex items-center justify-center gap-2 p-4 bg-red-600 hover:bg-red-500 rounded-2xl text-white font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:grayscale"
                                >
                                    <PhoneOff size={18} fill="currentColor" />
                                    Hangup
                                </button>
                            </div>

                            <p className="text-center text-xs text-blue-400 font-medium tracking-wide">Status: {sipStatus}</p>

                            {/* Invisible audio element to play remote stream */}
                            <audio ref={audioRef} style={{ display: 'none' }} autoPlay />
                        </div>
                    </ParticleCard>

                    <div className="p-6 bg-slate-900/40 border border-white/5 rounded-3xl">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-medium text-slate-400">Server Status</span>
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-xs text-slate-200">Asterisk Online</span>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                                <ShieldCheck size={18} className="text-blue-400" />
                                <span className="text-sm text-slate-300">PJSIP Backend Active</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-900/40 border border-white/5 rounded-3xl mt-6">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-medium text-slate-400">Mobile Gateway Config</span>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-500 uppercase font-bold tracking-wider ml-1">WebRTC Desktop IP</label>
                                    <input
                                        value={pbxWebsocketIp}
                                        onChange={(e) => setPbxWebsocketIp(e.target.value)}
                                        className="w-full p-3 bg-black/40 border border-blue-500/20 focus:border-blue-500/50 outline-none rounded-xl text-white font-mono transition-all text-sm"
                                        placeholder="127.0.0.1"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-500 uppercase font-bold tracking-wider ml-1">Phone LAN IP</label>
                                    <input
                                        value={pbxLocalIp}
                                        onChange={(e) => setPbxLocalIp(e.target.value)}
                                        className="w-full p-3 bg-black/40 border border-blue-500/20 focus:border-blue-500/50 outline-none rounded-xl text-white font-mono transition-all text-sm"
                                        placeholder="192.168.1.x"
                                    />
                                </div>
                            </div>
                            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                <p className="text-xs text-slate-400 mb-2">Enter these details into your Android SIP App (e.g. Sipnetic):</p>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <span className="text-slate-500">Server:</span>
                                    <span className="text-blue-400 font-mono text-right">{pbxLocalIp}</span>

                                    <span className="text-slate-500">Username:</span>
                                    <span className="text-emerald-400 font-mono text-right">2000</span>

                                    <span className="text-slate-500">Password:</span>
                                    <span className="text-emerald-400 font-mono text-right">5678</span>

                                    <span className="text-slate-500">Port:</span>
                                    <span className="text-emerald-400 font-mono text-right">5060</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-3 pt-2 border-t border-white/5">Note: 127.0.0.1 securely bypasses browser mixed-content restrictions!</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: History & Logs */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-6 bg-blue-600/5 border border-blue-500/10 rounded-3xl flex items-center justify-between">
                            <div>
                                <p className="text-slate-400 text-sm">Outbound Today</p>
                                <p className="text-3xl font-bold text-white mt-1">45</p>
                            </div>
                            <div className="p-3 bg-blue-500/20 rounded-2xl">
                                <PhoneOutgoing className="text-blue-400" size={24} />
                            </div>
                        </div>
                        <div className="p-6 bg-cyan-600/5 border border-cyan-500/10 rounded-3xl flex items-center justify-between">
                            <div>
                                <p className="text-slate-400 text-sm">Inbound Today</p>
                                <p className="text-3xl font-bold text-white mt-1">12</p>
                            </div>
                            <div className="p-3 bg-cyan-500/20 rounded-2xl">
                                <PhoneIncoming className="text-cyan-400" size={24} />
                            </div>
                        </div>
                    </div>

                    <div className="p-8 bg-black/40 backdrop-blur-md border border-white/5 rounded-3xl h-[500px] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Clock className="text-slate-500" size={20} />
                                Call Interaction Logs
                            </h3>
                            <div className="flex gap-2">
                                <div className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                                    Inbound
                                </div>
                                <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg text-[10px] text-blue-400 uppercase font-bold tracking-widest">
                                    Outbound
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                            {isLoading ? (
                                <p className="text-slate-600 italic">Syncing with Asterisk...</p>
                            ) : calls?.length > 0 ? (
                                calls.map((call: any) => (
                                    <div key={call.id} className="group p-6 bg-white/5 hover:bg-white/10 border border-white/5 rounded-3xl transition-all space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-2xl ${call.direction === 'inbound' ? 'bg-slate-800 text-slate-400' : 'bg-blue-600/20 text-blue-400'}`}>
                                                    {call.direction === 'inbound' ? <PhoneIncoming size={20} /> : <PhoneOutgoing size={20} />}
                                                </div>
                                                <div>
                                                    <p className="text-white font-bold flex items-center gap-2 uppercase tracking-tighter text-lg">
                                                        {call.from}
                                                        <span className="text-slate-600">→</span>
                                                        {call.to}
                                                    </p>
                                                    <p className="text-xs text-slate-500 font-mono mt-0.5">{new Date(call.createdAt).toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${call.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'
                                                    }`}>
                                                    {call.status}
                                                </span>
                                                <p className="text-sm text-slate-400 mt-1 font-medium">{call.duration || '00:00'}</p>
                                            </div>
                                        </div>

                                        {(call.summary || call.followUpPlan) && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
                                                {call.summary && (
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">AI Summary</p>
                                                        <p className="text-xs text-slate-300 leading-relaxed">{call.summary}</p>
                                                    </div>
                                                )}
                                                {call.followUpPlan && (
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] text-emerald-500/70 uppercase font-bold tracking-widest">Follow-up Plan</p>
                                                        <p className="text-xs text-emerald-400/90 leading-relaxed font-medium">{call.followUpPlan}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {call.transcript && (
                                            <details className="group/transcript">
                                                <summary className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer uppercase font-bold tracking-widest list-none flex items-center gap-1">
                                                    <span className="group-open/transcript:rotate-180 transition-transform">▼</span> View Full Transcript
                                                </summary>
                                                <div className="mt-2 text-[11px] text-slate-400 bg-black/20 p-3 rounded-xl border border-white/5 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                                                    {call.transcript}
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center opacity-30">
                                    <Phone size={48} className="mb-4" />
                                    <p>No call data yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
