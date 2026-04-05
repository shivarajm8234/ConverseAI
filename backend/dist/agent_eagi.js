#!/usr/bin/node
import fs from 'fs';
import { spawn } from 'child_process';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
function bootLog(msg) {
    try {
        fs.appendFileSync('/tmp/agent_debug.log', `[${new Date().toISOString()}] ${msg}`);
    }
    catch {
        /* ignore */
    }
    try {
        process.stderr.write(msg);
    }
    catch {
        /* ignore */
    }
}
/**
 * Read AGI preamble from stdin (lines until blank line). Required or Asterisk hangs up.
 * Parses `key: value` lines — use `agi_enhanced` to tell EAGI (fd 3 audio) from plain AGI (RECORD FILE only).
 */
function readAgiEnvironment() {
    const env = new Map();
    const byte = Buffer.alloc(1);
    let line = '';
    while (true) {
        const n = fs.readSync(0, byte, 0, 1, null);
        if (n !== 1) {
            throw new Error('AGI stdin closed before blank line (check Asterisk → AGI wiring)');
        }
        const c = byte.readUInt8(0);
        if (c === 0x0a) {
            if (line === '') {
                return env;
            }
            const idx = line.indexOf(':');
            if (idx > 0) {
                const key = line.slice(0, idx).trim();
                const val = line.slice(idx + 1).trim();
                env.set(key, val);
            }
            line = '';
        }
        else if (c !== 0x0d) {
            line += String.fromCharCode(c);
        }
    }
}
function isEagiEnhanced(agiEnv) {
    const v = agiEnv.get('agi_enhanced');
    if (v == null) {
        return false;
    }
    const n = Number.parseFloat(v);
    return n >= 1;
}
/** True only when the call is actually gone — NOT for result=-1 (writefile) etc. */
function shouldEndConversationAfterRecord(agiResultLine) {
    if (agiResultLine === 'EOF') {
        return true;
    }
    if (!/\bresult=-1\b/.test(agiResultLine)) {
        return false;
    }
    if (/\(writefile\)/i.test(agiResultLine)) {
        return false;
    }
    return true;
}
/** Send one AGI command on stdout and read the numeric result line from stdin. */
function agiCommand(cmd) {
    process.stdout.write(`${cmd}\n`);
    const b = Buffer.alloc(1);
    let acc = '';
    while (true) {
        const n = fs.readSync(0, b, 0, 1, null);
        if (n !== 1)
            return 'EOF';
        const ch = b.readUInt8(0);
        if (ch === 0x0a) {
            const line = acc.trimEnd();
            acc = '';
            if (line === '')
                continue;
            if (/^\d{3}\s/.test(line))
                return line;
            continue;
        }
        if (ch !== 0x0d)
            acc += String.fromCharCode(ch);
    }
}
// Load API keys for voice (GROQ, ELEVENLABS, …). Prefer deployed backend .env — do NOT use cwd first
// (Asterisk often runs AGI with cwd=/ or /var/lib/asterisk, which would skip the real .env).
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
// Use Groq for ultra-low latency voice agent
const groqKey = process.env.GROQ_API_KEY;
const openai = new OpenAI({
    apiKey: groqKey || process.env.OPENAI_API_KEY,
    baseURL: groqKey ? "https://api.groq.com/openai/v1" : undefined
});
const AI_MODEL = groqKey ? (process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile") : "gpt-4o-mini";
let conversationLog = [];
let messages = [];
function log(msg) {
    fs.appendFileSync('/tmp/agent_debug.log', `[${new Date().toISOString()}] ${msg}\n`);
    process.stderr.write(msg + "\n");
}
async function askKnowledgeGraph(text) {
    return "Ather showroom information: Ather 450X price is Rs 1,45,000. Features include 105km range, 90kmph top speed, and true smart dashboard.";
}
async function askLLM(prompt, context) {
    if (messages.length === 0) {
        messages.push({
            role: 'system',
            content: `You are Shruti, the lead showroom agent at Ather Space. You MUST speak ONLY in Kannada. 
            You are expert on Ather 450X, 450S, and Apex. 
            Keep replies under 30 words. Give brief conversational replies in Kannada script. 
            Do not use special characters or emojis. 
            Context: ${context}.`
        });
    }
    messages.push({ role: 'user', content: prompt });
    conversationLog.push(`User: ${prompt}`);
    try {
        const response = await openai.chat.completions.create({
            model: AI_MODEL,
            messages: messages,
            max_tokens: 100
        });
        const reply = response.choices?.[0]?.message?.content || "I'm having trouble thinking.";
        messages.push({ role: 'assistant', content: reply });
        conversationLog.push(`Shruti: ${reply}`);
        return reply;
    }
    catch (e) {
        process.stderr.write("LLM Error: " + e.message + "\n");
        return "I am unable to process your request at the moment.";
    }
}
async function generateTTS(text) {
    try {
        const mp3Path = '/tmp/tts_out.mp3';
        const wavPath = '/tmp/tts_asterisk.wav';
        const voiceId = 'Xb7hH8MSUJpSbSDYk0k2'; // Alice (Clear, Engaging, Female)
        const apiKey = process.env.ELEVENLABS_API_KEY;
        log(`Generating ElevenLabs TTS for: "${text}"\n`);
        if (!apiKey) {
            throw new Error("ELEVENLABS_API_KEY is missing in /opt/converse/backend/.env");
        }
        const response = await axios({
            method: 'post',
            url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            data: {
                text: text,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            },
            headers: {
                'Accept': 'audio/mpeg',
                'xi-api-key': apiKey,
                'Content-Type': 'application/json',
            },
            responseType: 'arraybuffer'
        });
        fs.writeFileSync(mp3Path, Buffer.from(response.data));
        log("TTS MP3 saved. Converting to WAV...\n");
        return new Promise((resolve, reject) => {
            // Convert to 8kHz mono WAV for Asterisk
            const ffmpeg = spawn('ffmpeg', ['-y', '-i', mp3Path, '-ar', '8000', '-ac', '1', wavPath]);
            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    log("WAV ready. Sending STREAM FILE to Asterisk...\n");
                    const agiResult = agiCommand('STREAM FILE /tmp/tts_asterisk ""');
                    log(`STREAM FILE AGI result: ${agiResult}\n`);
                    // AGI STREAM FILE blocks until playback completes; resolve on next tick only.
                    setImmediate(resolve);
                }
                else {
                    reject(new Error("FFMPEG failed"));
                }
            });
        });
    }
    catch (e) {
        if (e.response && e.response.data) {
            try {
                const errorObj = JSON.parse(Buffer.from(e.response.data).toString());
                process.stderr.write("TTS API Error: " + JSON.stringify(errorObj) + "\n");
            }
            catch (pErr) {
                process.stderr.write("TTS API Error: " + Buffer.from(e.response.data).toString() + "\n");
            }
        }
        else {
            process.stderr.write("TTS Error: " + e.message + "\n");
        }
    }
}
/** Debian/Ubuntu Asterisk packages omit res_eagi.so — use AGI() + RECORD FILE instead of EAGI(). */
async function runAgiRecordLoop() {
    log("AGI record mode (no EAGI fd 3): RECORD FILE loop — expect ~1–2s latency after each utterance\n");
    agiCommand('VERBOSE "VoiceAI: AGI record mode (Debian-compatible)" 3');
    // Use /tmp (absolute path) — spool/monitor often hits result=-1 (writefile) on Debian AppArmor/permissions; that is NOT a hangup.
    let seq = 0;
    while (true) {
        try {
            const base = `/tmp/voiceai_${process.pid}_${Date.now()}_${++seq}`;
            const absWav = `${base}.wav`;
            if (fs.existsSync(absWav)) {
                try {
                    fs.unlinkSync(absWav);
                }
                catch {
                    /* ignore */
                }
            }
            // Min args: RECORD FILE name fmt escape timeout [opts]. Do not insert dummy "0" before s= — that triggers a beep (see res_agi handle_recordfile).
            const recLine = agiCommand(`RECORD FILE ${base} wav "" 120000 s=3`);
            log(`RECORD FILE result: ${recLine}\n`);
            if (shouldEndConversationAfterRecord(recLine)) {
                log('RECORD FILE: channel ended or stdin closed — stopping conversation loop\n');
                break;
            }
            if (/\(writefile\)/i.test(recLine)) {
                log('RECORD FILE write failed (check /tmp and asterisk user) — retrying\n');
                continue;
            }
            if (!fs.existsSync(absWav)) {
                log(`No recording at ${absWav}, continuing\n`);
                continue;
            }
            const st = fs.statSync(absWav);
            if (st.size < 2000) {
                log(`Recording too small (${st.size} B), skip STT\n`);
                continue;
            }
            log("Transcribing recorded utterance...\n");
            const text = await transcribeSTT(absWav);
            log(`User transcribed: "${text}"\n`);
            if (text && text.trim().length > 1) {
                log("Thinking about reply...\n");
                const reply = await askLLM(text, "Ather showroom information: Ather 450X price is Rs 1,45,000. Features include 105km range, 90kmph top speed.");
                log(`AI replying: "${reply}"\n`);
                await generateTTS(reply);
            }
        }
        catch (e) {
            log(`Record loop error: ${e instanceof Error ? e.message : String(e)}\n`);
            break;
        }
    }
}
async function transcribeSTT(wavFile) {
    try {
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(wavFile),
            model: groqKey ? "whisper-large-v3" : "whisper-1",
            language: "kn",
            prompt: "Ather, 450X, 450S, Apex, electric scooter, showroom, Kannada"
        });
        return transcription.text;
    }
    catch (e) {
        log("STT Error: " + e.message + "\n");
        return "";
    }
}
async function startAgent() {
    process.on('SIGINT', () => process.exit(0));
    bootLog(`agent_eagi start node=${process.version} uid=${typeof process.getuid === 'function' ? process.getuid() : '?'}\n`);
    let agiEnv;
    try {
        agiEnv = readAgiEnvironment();
        log("AGI environment read OK\n");
    }
    catch (e) {
        const m = `AGI handshake failed: ${e?.message ?? e}\n`;
        bootLog(m);
        process.exit(1);
    }
    const useEagiStream = isEagiEnhanced(agiEnv);
    log(`agi_enhanced=${agiEnv.get('agi_enhanced') ?? 'unset'} → ${useEagiStream ? 'EAGI stream (fd 3)' : 'AGI RECORD FILE conversation (no early exit on fd 3)'}\n`);
    // Initial Greeting in Kannada
    const greetingMsg = "ನಮಸ್ಕಾರ! ನಾನು ಅಥರ್ ಶೋರೂಮ್‌ನಿಂದ ಶ್ರುತಿ ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ. ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?";
    await generateTTS(greetingMsg);
    if (!useEagiStream) {
        log("Starting AGI conversation loop (RECORD FILE) — Debian-compatible\n");
        await runAgiRecordLoop();
        return;
    }
    // EAGI only: raw 8kHz slinear16 mono on file descriptor 3 (agi_enhanced was set by Asterisk)
    try {
        try {
            fs.fstatSync(3);
            log("EAGI fd 3 present (fstat ok)\n");
        }
        catch (fe) {
            log(`EAGI expected but fd 3 missing: ${fe?.message ?? fe} — falling back to RECORD FILE\n`);
            await runAgiRecordLoop();
            return;
        }
        const audioBuffer = Buffer.alloc(320); // 20ms of audio at 8kHz
        let isReading = true;
        let callerAudioBuffer = Buffer.alloc(0);
        let isSpeaking = false;
        let silenceChunks = 0;
        let dataCounter = 0;
        let zeroReads = 0;
        const SILENCE_THRESHOLD = 500;
        async function processAudio() {
            while (isReading) {
                try {
                    const bytesRead = fs.readSync(3, audioBuffer, 0, 320, null);
                    if (bytesRead === 0) {
                        zeroReads++;
                        await new Promise((r) => setTimeout(r, 20));
                        if (zeroReads > 200) {
                            log("fd3 returned 0 repeatedly; stopping read loop\n");
                            isReading = false;
                            break;
                        }
                        continue;
                    }
                    zeroReads = 0;
                    if (bytesRead > 0) {
                        const chunk = audioBuffer.subarray(0, bytesRead);
                        dataCounter++;
                        if (dataCounter % 1000 === 0) {
                            log(`Processing audio stream... (Counter: ${dataCounter})\n`);
                        }
                        // Silence detection
                        let maxAmp = 0;
                        for (let i = 0; i < chunk.length; i += 2) {
                            const sample = chunk.readInt16LE(i);
                            if (Math.abs(sample) > maxAmp)
                                maxAmp = Math.abs(sample);
                        }
                        if (maxAmp > SILENCE_THRESHOLD) {
                            if (!isSpeaking)
                                log("🔊 Voice detected!\n");
                            isSpeaking = true;
                            silenceChunks = 0;
                        }
                        else {
                            silenceChunks++;
                        }
                        if (isSpeaking) {
                            callerAudioBuffer = Buffer.concat([callerAudioBuffer, chunk]);
                        }
                        // Silence reached threshold - process speech
                        if (isSpeaking && silenceChunks > 30) { // ~600ms of silence
                            isSpeaking = false;
                            const finalBuffer = callerAudioBuffer;
                            callerAudioBuffer = Buffer.alloc(0);
                            log("Speech finished. Processing...\n");
                            const tempPcm = '/tmp/caller_in.sln';
                            const tempWav = '/tmp/caller_in.wav';
                            fs.writeFileSync(tempPcm, finalBuffer);
                            const ffmpeg = spawn('ffmpeg', ['-y', '-f', 's16le', '-ar', '8000', '-ac', '1', '-i', tempPcm, tempWav]);
                            ffmpeg.on('close', async () => {
                                log("Transcribing audio...\n");
                                const text = await transcribeSTT(tempWav);
                                log(`User transcribed: "${text}"\n`);
                                if (text && text.trim().length > 1) {
                                    log(`Thinking about reply...\n`);
                                    const reply = await askLLM(text, "Ather showroom information: Ather 450X price is Rs 1,45,000. Features include 105km range, 90kmph top speed.");
                                    log(`AI replying: "${reply}"\n`);
                                    await generateTTS(reply);
                                }
                            });
                        }
                    }
                }
                catch (err) {
                    if (err.code === 'EAGAIN' || err.code === 'EWOULDBLOCK') {
                        await new Promise(r => setTimeout(r, 10)); // Slow down and retry
                        continue;
                    }
                    log(`Fatal Read error: ${err.message}\n`);
                    isReading = false;
                    break;
                }
            }
        }
        await processAudio().catch((e) => log(`Stream Processor Error: ${e instanceof Error ? e.message : String(e)}\n`));
    }
    catch (e) {
        log(`Failed to initialize EAGI stream: ${e.message}\n`);
    }
}
startAgent().catch((e) => {
    log(`Fatal: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
});
//# sourceMappingURL=agent_eagi.js.map