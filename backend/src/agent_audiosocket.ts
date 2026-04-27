import net from 'net';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { WebSocket } from 'ws';
import OpenAI from 'openai';
import { prisma } from './utils/db.js';
import { getKnowledgeContext, searchVectorStore, openai as aiClient, chatModel } from './utils/ai.js';

// Load Environment
const envPaths = [
    '/opt/converse/backend/.env',
    path.join(path.dirname(new URL(import.meta.url).pathname), '../.env'),
    path.join(process.cwd(), '.env'),
];
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath, override: true });
        break;
    }
}

const sarvamKey = process.env.SARVAM_API_KEY;
const AUDIOSOCKET_PORT = 9092;
const SAMPLE_RATE = 8000;

function log(msg: string) {
    try {
        fs.appendFileSync('/tmp/agent_audiosocket.log', `[${new Date().toISOString()}] ${msg}\n`);
        console.log(msg);
    } catch {}
}

/**
 * AudioSocket Header:
 * Byte 0: UUID (0x01) or Audio (0x10) or Hangup (0x00)
 * Byte 1-2: Payload Length (Big Endian)
 */
function createAudioSocketHeader(id: number, length: number): Buffer {
    const header = Buffer.alloc(3);
    header[0] = id;
    header.writeUInt16BE(length, 1);
    return header;
}

class CallSession {
    socket: net.Socket;
    sttWs: WebSocket | null = null;
    fullTranscript: string = '';
    activeKnowledge: string = '';
    isAitalking: boolean = false;
    phone: string = 'unknown';
    currentLanguage: 'kn-IN' | 'hi-IN' | 'en-IN' = 'kn-IN';
    isLanguageLocked: boolean = false;
    abortController: AbortController | null = null;
    startTime: number = Date.now();

    constructor(socket: net.Socket) {
        this.socket = socket;
    }

    async init() {
        log("📞 New Call Started via AudioSocket");
        this.activeKnowledge = await getKnowledgeContext().catch(() => "Ather Energy default context.");
        
        // Setup STT first
        this.setupSarvamSTT();

        // 1. Play the custom language intro file
        const introPath = path.join(process.cwd(), 'language_intro.wav');
        if (fs.existsSync(introPath)) {
            log("🔊 Playing Language Intro file...");
            await this.streamFile(introPath);
        } else {
            // Fallback if file missing
            await this.speak("ನಮಸ್ಕಾರ! ನಿಮಗೆ ಯಾವ ಭಾಷೆ ಇಷ್ಟ? ಕನ್ನಡ, ಹಿಂದಿ ಅಥವಾ ಇಂಗ್ಲಿಷ್?", 'kn-IN');
        }
    }

    async streamFile(filePath: string) {
        const stream = fs.createReadStream(filePath);
        for await (const chunk of stream) {
            await new Promise(r => setTimeout(r, 15)); 
            const header = createAudioSocketHeader(0x10, chunk.length);
            this.socket.write(Buffer.concat([header, chunk]));
        }
    }

    setupSarvamSTT() {
        if (!sarvamKey) return;
        this.sttWs = new WebSocket('wss://api.sarvam.ai/speech-to-text/ws', {
            headers: { 'api-subscription-key': sarvamKey }
        });

        this.sttWs.on('open', () => {
            log("🎙️ Sarvam STT WebSocket Connected");
            this.sttWs?.send(JSON.stringify({
                config: {
                    language_code: 'unknown',
                    model: 'saaras:v3',
                    mode: 'codemix',
                    sample_rate: SAMPLE_RATE,
                    encoding: 'pcm_s16le'
                }
            }));
        });

        this.sttWs.on('message', async (data) => {
            const msg = JSON.parse(data.toString());
            
            // BARGE-IN
            if (msg.transcript && this.isAitalking) {
                log("🛑 User Interrupted! Aborting AI speech.");
                this.abortController?.abort();
                this.isAitalking = false;
            }

            if (msg.transcript && msg.is_final) {
                const text = msg.transcript.trim();
                log(`👤 User: ${text}`);

                if (!this.isLanguageLocked) {
                    if (/hindi/i.test(text) || /ಹಿಂದಿ/i.test(text)) this.currentLanguage = 'hi-IN';
                    else if (/english/i.test(text) || /ಇಂಗ್ಲಿಷ್/i.test(text)) this.currentLanguage = 'en-IN';
                    else this.currentLanguage = 'kn-IN';
                    
                    this.isLanguageLocked = true;
                    log(`🔒 Language Locked to: ${this.currentLanguage}`);
                    
                    const ack = this.currentLanguage === 'hi-IN' ? "ठीक है, हम हिंदी में बात करेंगे।" : 
                                this.currentLanguage === 'en-IN' ? "Sure, let's talk in English." : 
                                "ಸರಿ, ನಾವು ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡೋಣ.";
                    await this.speak(ack, this.currentLanguage);
                    return;
                }

                if (text.length > 1) {
                    await this.handleUserIntent(text, this.currentLanguage);
                }
            }
        });
    }

    async handleUserIntent(text: string, lang: string) {
        try {
            // Enhanced Vector Search
            const context = await searchVectorStore(text, 3);
            
            const systemPrompt = `You are Shruti, the official AI Voice Assistant for Ather Energy. 
Support languages: Kannada (kn-IN), Hindi (hi-IN), English (en-IN).

KNOWLEDGE BASE:
${context || this.activeKnowledge}

Instructions:
1. USE THE KNOWLEDGE BASE ABOVE. If the information is there, you MUST use it.
2. Respond in the EXACT language the user is speaking.
3. CRITICAL: All numbers, prices, and technical specifications (range, top speed, battery capacity, dates) MUST be written in English.
4. Be professional, helpful, and concise (under 30 words).
5. Use plain text only. No markdown.`;

            const completion = await aiClient.chat.completions.create({
                model: chatModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: text },
                ],
            });
            const reply = completion.choices[0]?.message?.content ?? "...";
            log(`🤖 AI: ${reply}`);
            this.fullTranscript += `User: ${text}\nAI: ${reply}\n`;
            await this.speak(reply, lang as any);
        } catch (e: any) { log(`LLM Error: ${e.message}`); }
    }

    async speak(text: string, lang: 'kn-IN' | 'hi-IN' | 'en-IN') {
        if (!sarvamKey) return;
        
        this.abortController = new AbortController();
        const signal = this.abortController.signal;
        this.isAitalking = true;

        try {
            const speakerMap: Record<string, string> = {
                'kn-IN': 'shruti',
                'hi-IN': 'neha',
                'en-IN': 'neha'
            };

            const response = await fetch('https://api.sarvam.ai/text-to-speech/stream', {
                method: 'POST',
                headers: { 'api-subscription-key': sarvamKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    target_language_code: lang,
                    model: 'bulbul:v3',
                    speech_sample_rate: SAMPLE_RATE,
                    output_audio_codec: 'pcm',
                    speaker: speakerMap[lang] || 'shruti'
                }),
                signal
            });

            if (!response.body) return;
            const reader = response.body.getReader();

            while (true) {
                if (signal.aborted) break;
                const { done, value } = await reader.read();
                if (done) break;
                
                let offset = 0;
                while (offset < value.length) {
                    if (signal.aborted) break;
                    const chunkSize = Math.min(value.length - offset, 320);
                    const payload = value.slice(offset, offset + chunkSize);
                    this.socket.write(Buffer.concat([createAudioSocketHeader(0x10, payload.length), payload]));
                    offset += chunkSize;
                }
            }
        } catch (e: any) {
            if (e.name === 'AbortError') log("ℹ️ TTS stream aborted.");
            else log(`TTS Error: ${e.message}`);
        } finally {
            this.isAitalking = false;
        }
    }

    handleAudioFromAsterisk(data: Buffer) {
        if (this.sttWs?.readyState === WebSocket.OPEN) {
            this.sttWs.send(data);
        }
    }

    async cleanup() {
        log("🏁 Call Ended");
        this.sttWs?.close();
        
        if (this.fullTranscript.length > 10) {
            try {
                let customer = await prisma.customer.findFirst({ where: { phone: this.phone } });
                if (!customer) customer = await prisma.customer.create({ data: { phone: this.phone, name: 'Guest' } });

                await prisma.call.create({
                    data: {
                        customerId: customer.id,
                        transcript: this.fullTranscript,
                        duration: Math.floor((Date.now() - this.startTime) / 1000),
                        type: 'INBOUND',
                        summary: 'AudioSocket Streaming Call'
                    }
                });
                log("✅ Call saved to Database.");
            } catch (e: any) { log(`DB Error: ${e.message}`); }
        }
    }
}

const server = net.createServer((socket) => {
    const session = new CallSession(socket);
    session.init();

    let buffer = Buffer.alloc(0);

    socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        
        while (buffer.length >= 3) {
            const id = buffer[0];
            const length = buffer.readUInt16BE(1);
            
            if (buffer.length < 3 + length) break;

            const payload = buffer.slice(3, 3 + length);
            buffer = buffer.slice(3 + length);

            if (id === 0x10) { // Audio Data
                session.handleAudioFromAsterisk(payload);
            } else if (id === 0x01) { // UUID Info
                session.phone = payload.toString();
                log(`📞 Caller UUID/Phone: ${session.phone}`);
            } else if (id === 0x00) { // Hangup
                socket.end();
            }
        }
    });

    socket.on('end', () => session.cleanup());
    socket.on('error', (e) => log(`Socket Error: ${e.message}`));
});

server.listen(AUDIOSOCKET_PORT, '0.0.0.0', () => {
    log(`🚀 AudioSocket Server Listening on port ${AUDIOSOCKET_PORT}`);
});
