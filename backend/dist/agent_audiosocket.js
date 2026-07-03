import net from 'net';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { WebSocket } from 'ws';
import OpenAI from 'openai';
import { prisma } from './utils/db.js';
// Load Environment
const envPaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'backend', '.env'),
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
// Configure OpenAI client to use Sarvam for LLM
const aiClient = new OpenAI({
    apiKey: sarvamKey,
    baseURL: 'https://api.sarvam.ai',
    defaultHeaders: { 'api-subscription-key': sarvamKey }
});
const AI_MODEL = 'gajendra:v1';
const COMMUNITY_SUPPORT_PROMPT = `You are a real-time voice reporting assistant for an informal settlement (slum) resource tracking system.

LANGUAGE RULE (STRICT):
* You may ONLY speak in: 1. Kannada, 2. Hindi, 3. English.
* Never use any other language.
* Detect the caller’s language from their first sentence.
* Reply in the same language.
* If unclear, ask: "Would you prefer Kannada, Hindi, or English?"
* Once language is chosen, do NOT switch.

CORE BEHAVIOR:
* You are collecting data on WASTED SHARED RESOURCES (Water, Electricity, Materials/Waste).
* Speak in short, clear, natural sentences suitable for basic phone voice calls.
* Ask only ONE question at a time.
* Never assume information. Only use what the caller says.
* Never hallucinate facts, names, or events.
* Do not explain internal processes, tech, or systems.

PRIVACY FIRST (MANDATORY STEP):
Before recording any report, ask:
ENGLISH: "How would you like to be identified? You can stay anonymous, share only your area, or share your name and number."
HINDI: "Aap kaise pehchaan dena chahenge? Aap anonymous reh sakte hain, sirf area bata sakte hain, ya apna naam aur number share kar sakte hain."
KANNADA: "ನಿಮ್ಮ ಗುರುತನ್ನು ಹೇಗೆ ಹಂಚಿಕೊಳ್ಳಲು ಇಷ್ಟಪಡುತ್ತೀರಿ? ನೀವು ಅನಾಮಧೇಯವಾಗಿರಬಹುದು, ನಿಮ್ಮ ಪ್ರದೇಶ ಮಾತ್ರ ಹೇಳಬಹುದು, ಅಥವಾ ನಿಮ್ಮ ಹೆಸರು ಮತ್ತು ಸಂಖ್ಯೆ ಹಂಚಿಕೊಳ್ಳಬಹುದು."

Wait for response and store: Anonymous, Partial identity, or Full identity.

FLOW:
STEP 1 — GREETING: "Namaste. What shared resource issue or waste are you reporting today? Water, Electricity, or Garbage?"
STEP 2 — INFORMATION COLLECTION: Ask one by one:
  - Location (Which tap, pole, or street?)
  - Problem (What exactly is wasting?)
  - Duration (Since when?)
STEP 3 — VALIDATION: Summarize briefly: "Let me confirm: [summary]. Is this correct?"
STEP 4 — RESPONSE & NUDGE: "Thank you. Your report has been added to the community dashboard. Your action helps save our shared resources."
STEP 5 — CLOSE: "Goodbye. Your voice matters."

STRICT PROHIBITIONS:
* No guessing
* No extra details
* No long explanations
* No multiple questions
* No language switching

OUTPUT STYLE:
* Short sentences, natural spoken tone, no technical language.
* CRITICAL: Your response MUST start with the language code (kn-IN, hi-IN, or en-IN) followed by a newline.

You are only a listener and data collector for the community accountability loop. Nothing more.`;
function log(msg) {
    try {
        fs.appendFileSync('/tmp/agent_audiosocket.log', `[${new Date().toISOString()}] ${msg}\n`);
        console.log(msg);
    }
    catch { }
}
function createAudioSocketHeader(id, length) {
    const header = Buffer.alloc(3);
    header[0] = id;
    header.writeUInt16BE(length, 1);
    return header;
}
class CallSession {
    socket;
    sttWs = null;
    fullTranscript = []; // Store as array of objects for better context
    isAitalking = false;
    phone = 'unknown';
    currentLanguage = null;
    abortController = null;
    startTime = Date.now();
    constructor(socket) {
        this.socket = socket;
    }
    async init() {
        log("📞 Community Support Call Started");
        this.setupSarvamSTT();
        // Step 1: Greeting
        await this.speak("ನಮಸ್ತೆ. ನೀವು ಇಂದು ಯಾವ ಹಂಚಿಕೆಯ ಸಂಪನ್ಮೂಲ ಸಮಸ್ಯೆ ಅಥವಾ ವ್ಯರ್ಥವನ್ನು ವರದಿ ಮಾಡುತ್ತಿದ್ದೀರಿ? ನೀರು, ವಿದ್ಯುತ್ ಅಥವಾ ಕಸ?", 'kn-IN', new AbortController().signal);
    }
    setupSarvamSTT() {
        if (!sarvamKey)
            return;
        this.sttWs = new WebSocket('wss://api.sarvam.ai/speech-to-text/ws', {
            headers: { 'api-subscription-key': sarvamKey }
        });
        this.sttWs.on('open', () => {
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
        this.sttWs.on('error', (err) => {
            log(`STT WebSocket Error: ${err.message}`);
        });
        this.sttWs.on('message', async (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.transcript && this.isAitalking) {
                this.abortController?.abort();
                this.isAitalking = false;
            }
            if (msg.transcript && msg.is_final) {
                const text = msg.transcript.trim();
                log(`👤 User: ${text}`);
                if (text.length > 1) {
                    await this.handleUserIntent(text);
                }
            }
        });
    }
    async handleUserIntent(text) {
        try {
            this.abortController = new AbortController();
            const signal = this.abortController.signal;
            this.fullTranscript.push({ role: 'user', content: text });
            const messages = [
                { role: 'system', content: COMMUNITY_SUPPORT_PROMPT },
                ...this.fullTranscript.slice(-10) // Keep last 10 turns for context
            ];
            const stream = await aiClient.chat.completions.create({
                model: AI_MODEL,
                messages: messages,
                stream: true,
            }, { signal });
            let fullReply = '';
            let currentSentence = '';
            let hasParsedLang = false;
            let detectedLang = this.currentLanguage || 'en-IN';
            for await (const chunk of stream) {
                if (signal.aborted)
                    break;
                const content = chunk.choices[0]?.delta?.content || '';
                fullReply += content;
                if (!hasParsedLang) {
                    if (fullReply.includes('\n')) {
                        const parts = fullReply.split('\n');
                        const langTag = parts[0].trim();
                        if (langTag === 'kn-IN' || langTag === 'hi-IN' || langTag === 'en-IN') {
                            detectedLang = langTag;
                            this.currentLanguage = detectedLang;
                            currentSentence = parts.slice(1).join('\n');
                        }
                        else {
                            currentSentence = fullReply;
                        }
                        hasParsedLang = true;
                    }
                    continue;
                }
                currentSentence += content;
                if (/[.!?\n।]/.test(currentSentence)) {
                    const sentences = currentSentence.split(/(?<=[.!?\n।] )/);
                    if (sentences.length > 1) {
                        const toSpeak = sentences.shift()?.trim();
                        currentSentence = sentences.join(' ');
                        if (toSpeak && toSpeak.length > 1) {
                            await this.speak(toSpeak, detectedLang, signal);
                        }
                    }
                }
            }
            if (!signal.aborted && currentSentence.trim().length > 1) {
                await this.speak(currentSentence.trim(), detectedLang, signal);
            }
            this.fullTranscript.push({ role: 'assistant', content: fullReply });
        }
        catch (e) {
            if (e.name !== 'AbortError')
                log(`LLM Error: ${e.message}`);
        }
    }
    async speak(text, lang, signal) {
        if (!sarvamKey || signal.aborted)
            return;
        this.isAitalking = true;
        log(`🤖 AI (${lang}): ${text}`);
        try {
            const response = await fetch('https://api.sarvam.ai/text-to-speech/stream', {
                method: 'POST',
                headers: { 'api-subscription-key': sarvamKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    target_language_code: lang,
                    model: 'bulbul:v3',
                    speech_sample_rate: SAMPLE_RATE,
                    output_audio_codec: 'pcm',
                    speaker: lang === 'kn-IN' ? 'shruti' : 'neha'
                }),
                signal
            });
            if (!response.body)
                return;
            const reader = response.body.getReader();
            while (true) {
                if (signal.aborted)
                    break;
                const { done, value } = await reader.read();
                if (done)
                    break;
                let offset = 0;
                while (offset < value.length) {
                    if (signal.aborted)
                        break;
                    const chunkSize = Math.min(value.length - offset, 320);
                    const payload = value.slice(offset, offset + chunkSize);
                    this.socket.write(Buffer.concat([createAudioSocketHeader(0x10, payload.length), payload]));
                    offset += chunkSize;
                }
            }
        }
        catch (e) {
            if (e.name !== 'AbortError')
                log(`TTS Error: ${e.message}`);
        }
        finally {
            this.isAitalking = false;
        }
    }
    handleAudioFromAsterisk(data) {
        if (this.sttWs?.readyState === WebSocket.OPEN) {
            this.sttWs.send(data);
        }
    }
    async cleanup() {
        log("🏁 Call Ended");
        this.sttWs?.close();
        this.abortController?.abort();
        if (this.fullTranscript.length > 2) {
            try {
                let customer = await prisma.customer.findFirst({ where: { phone: this.phone } });
                if (!customer)
                    customer = await prisma.customer.create({ data: { phone: this.phone, name: 'Community Member' } });
                const transcriptText = this.fullTranscript.map((m) => `${m.role}: ${m.content}`).join('\n');
                await prisma.call.create({
                    data: {
                        customerId: customer.id,
                        transcript: transcriptText,
                        duration: Math.floor((Date.now() - this.startTime) / 1000),
                        type: 'INBOUND',
                        summary: 'Community Support Complaint'
                    }
                });
            }
            catch (e) {
                log(`DB Error: ${e.message}`);
            }
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
            if (buffer.length < 3 + length)
                break;
            const payload = buffer.slice(3, 3 + length);
            buffer = buffer.slice(3 + length);
            if (id === 0x10)
                session.handleAudioFromAsterisk(payload);
            else if (id === 0x01)
                session.phone = payload.toString();
            else if (id === 0x00)
                socket.end();
        }
    });
    socket.on('end', () => session.cleanup());
    socket.on('error', () => { });
});
server.listen(AUDIOSOCKET_PORT, '0.0.0.0', () => {
    log(`🚀 Community Support Voice Agent Listening on port ${AUDIOSOCKET_PORT}`);
});
//# sourceMappingURL=agent_audiosocket.js.map