#!/usr/bin/node
import fs from 'fs';
import { spawn } from 'child_process';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { InferenceClient } from '@huggingface/inference';
const HF_ROUTER_INFERENCE = 'https://router.huggingface.co/hf-inference/models';
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
// Load API keys for voice (GROQ, HF TTS, …). Prefer deployed backend .env — do NOT use cwd first
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
/** https://docs.sarvam.ai/api-reference-docs/text-to-speech/convert — header `api-subscription-key` */
const sarvamKey = process.env.SARVAM_API_KEY || process.env.SARVAM_SUBSCRIPTION_KEY;
const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech';
const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';
/** MMS checkpoints when HF_TTS_ENGINE=mms or as Parler fallback */
const TTS_MODELS_MMS = {
    kn: process.env.HF_TTS_MODEL_KN ?? 'facebook/mms-tts-kan',
    hi: process.env.HF_TTS_MODEL_HI ?? 'facebook/mms-tts-hin',
    en: process.env.HF_TTS_MODEL_EN ?? 'facebook/mms-tts-eng',
};
const PARLER_MODEL_ID = process.env.HF_PARLER_MODEL ?? 'ai4bharat/indic-parler-tts';
/** Style captions for [Indic Parler-TTS](https://huggingface.co/ai4bharat/indic-parler-tts) — tuned for showroom voice. */
const PARLER_CAPTIONS = {
    kn: process.env.HF_PARLER_CAPTION_KN ??
        "Anu speaks with a warm, clear female voice at a moderate pace, slightly expressive, professional showroom tone. Very high quality recording, close microphone, no background noise.",
    hi: process.env.HF_PARLER_CAPTION_HI ??
        "Divya speaks with a clear, warm female voice at a moderate pace, slightly expressive, professional tone. Very high quality recording, close microphone, no background noise.",
    en: process.env.HF_PARLER_CAPTION_EN ??
        "Mary speaks clear Indian English with a warm, professional female voice at a moderate pace. Very high quality recording, close microphone, no background noise.",
};
function ttsEngine() {
    const v = (process.env.HF_TTS_ENGINE ?? 'parler').toLowerCase();
    return v === 'mms' ? 'mms' : 'parler';
}
function inferLangFromText(text) {
    if (/[\u0C80-\u0CFF]/.test(text)) {
        return 'kn';
    }
    if (/[\u0900-\u097F]/.test(text)) {
        return 'hi';
    }
    return 'en';
}
function normalizeWhisperLang(code, text) {
    if (!code) {
        return inferLangFromText(text);
    }
    const c = code.toLowerCase().replace(/_.*$/, '').slice(0, 2);
    if (c === 'kn' || c === 'ka') {
        return 'kn';
    }
    if (c === 'hi' || c === 'gu' || c === 'mr' || c === 'ne' || c === 'pa') {
        return 'hi';
    }
    if (c === 'en') {
        return 'en';
    }
    return inferLangFromText(text);
}
function pickTtsLang(replyText, userLang) {
    const fromReply = inferLangFromText(replyText);
    if (fromReply !== 'en') {
        return fromReply;
    }
    if (userLang !== 'en') {
        return userLang;
    }
    return 'en';
}
function langLabel(l) {
    if (l === 'kn') {
        return 'Kannada (ಕನ್ನಡ)';
    }
    if (l === 'hi') {
        return 'Hindi (Devanagari)';
    }
    return 'English';
}
function langToSarvamBcp47(lang) {
    if (lang === 'kn') {
        return 'kn-IN';
    }
    if (lang === 'hi') {
        return 'hi-IN';
    }
    return 'en-IN';
}
function sarvamBcp47ToLangCode(code) {
    if (!code || code === 'unknown') {
        return 'en';
    }
    const lower = code.toLowerCase();
    if (lower.startsWith('kn')) {
        return 'kn';
    }
    if (lower.startsWith('hi')) {
        return 'hi';
    }
    return 'en';
}
const SARVAM_SPEAKERS = {
    kn: process.env.SARVAM_SPEAKER_KN ?? 'shruti',
    hi: process.env.SARVAM_SPEAKER_HI ?? 'neha',
    en: process.env.SARVAM_SPEAKER_EN ?? 'meera',
};
/**
 * Indic Parler-TTS expects transcript + natural-language description (see model card).
 * Router: https://router.huggingface.co/hf-inference/models/{model}
 */
async function synthesizeIndicParlerTts(transcript, description, hfToken, modelId) {
    const url = `${HF_ROUTER_INFERENCE}/${modelId}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            inputs: transcript,
            parameters: { description },
        }),
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Indic Parler HTTP ${res.status}: ${errText.slice(0, 600)}`);
    }
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
        const j = (await res.json());
        throw new Error(`Indic Parler returned JSON: ${JSON.stringify(j).slice(0, 400)}`);
    }
    return Buffer.from(await res.arrayBuffer());
}
async function ffmpegToAsteriskWav(inPath, outPath) {
    return new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', ['-y', '-i', inPath, '-ar', '8000', '-ac', '1', outPath]);
        ff.on('close', (code) => {
            if (code === 0) {
                resolve();
            }
            else {
                reject(new Error(`ffmpeg exit ${code}`));
            }
        });
    });
}
/** Decode TTS bytes → 8 kHz mono WAV Asterisk expects → STREAM FILE */
async function playPcmAudioBufferToAsterisk(audioBuf) {
    const rawWav = '/tmp/tts_hf_raw.wav';
    const outWav = '/tmp/tts_asterisk.wav';
    fs.writeFileSync(rawWav, audioBuf);
    await ffmpegToAsteriskWav(rawWav, outWav);
    log('WAV 8kHz ready. STREAM FILE to Asterisk...\n');
    const agiResult = agiCommand('STREAM FILE /tmp/tts_asterisk ""');
    log(`STREAM FILE AGI result: ${agiResult}\n`);
}
async function synthesizeSarvamTts(trimmed, ttsLang, key) {
    const body = {
        text: trimmed,
        target_language_code: langToSarvamBcp47(ttsLang),
        model: process.env.SARVAM_TTS_MODEL ?? 'bulbul:v3',
        speech_sample_rate: process.env.SARVAM_TTS_SAMPLE_RATE ?? '8000',
        output_audio_codec: 'wav',
        speaker: SARVAM_SPEAKERS[ttsLang],
        pace: Number.parseFloat(process.env.SARVAM_TTS_PACE ?? '1') || 1,
    };
    const res = await fetch(SARVAM_TTS_URL, {
        method: 'POST',
        headers: {
            'api-subscription-key': key,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const raw = await res.text();
    if (!res.ok) {
        throw new Error(`Sarvam TTS HTTP ${res.status}: ${raw.slice(0, 500)}`);
    }
    let json;
    try {
        json = JSON.parse(raw);
    }
    catch {
        throw new Error(`Sarvam TTS: non-JSON response: ${raw.slice(0, 200)}`);
    }
    if (json.error?.message) {
        throw new Error(`Sarvam TTS: ${json.error.message}`);
    }
    const b64 = json.audios?.[0];
    if (!b64) {
        throw new Error('Sarvam TTS: empty audios[]');
    }
    return Buffer.from(b64, 'base64');
}
async function transcribeSarvam(wavFile, key) {
    const buf = fs.readFileSync(wavFile);
    const form = new FormData();
    form.append('file', new Blob([buf], { type: 'audio/wav' }), 'speech.wav');
    const sttModel = process.env.SARVAM_STT_MODEL ?? 'saaras:v3';
    form.append('model', sttModel);
    form.append('language_code', process.env.SARVAM_STT_LANGUAGE_CODE ?? 'unknown');
    if (sttModel === 'saaras:v3') {
        form.append('mode', process.env.SARVAM_STT_MODE ?? 'transcribe');
    }
    const res = await fetch(SARVAM_STT_URL, {
        method: 'POST',
        headers: {
            'api-subscription-key': key,
        },
        body: form,
    });
    const raw = await res.text();
    if (!res.ok) {
        throw new Error(`Sarvam STT HTTP ${res.status}: ${raw.slice(0, 500)}`);
    }
    const json = JSON.parse(raw);
    if (json.error?.message) {
        throw new Error(`Sarvam STT: ${json.error.message}`);
    }
    const text = json.transcript ?? '';
    const detected = json.language_code;
    const lang = !detected || detected === 'unknown' ? inferLangFromText(text) : sarvamBcp47ToLangCode(detected);
    return { text, lang };
}
let conversationLog = [];
let messages = [];
function log(msg) {
    fs.appendFileSync('/tmp/agent_debug.log', `[${new Date().toISOString()}] ${msg}\n`);
    process.stderr.write(msg + "\n");
}
async function askKnowledgeGraph(text) {
    return "Ather showroom information: Ather 450X price is Rs 1,45,000. Features include 105km range, 90kmph top speed, and true smart dashboard.";
}
async function askLLM(prompt, context, userLang) {
    if (messages.length === 0) {
        messages.push({
            role: 'system',
            content: `You are Shruti, a professional Ather Space showroom voice agent.
You answer questions about Ather electric scooters (450X, 450S, Apex, pricing, range, features, test rides).

Language rules (critical):
- Each user message starts with [Speak in …] — reply ONLY in that language and script (Kannada / Hindi Devanagari / English Latin).
- If the user switches language on a later turn, follow the new prefix.
- Keep answers accurate, friendly, and concise (under 45 words) unless they ask for detail.
- No emojis or markdown.

Context: ${context}.`,
        });
    }
    messages.push({
        role: 'user',
        content: `[Speak in ${langLabel(userLang)}] ${prompt}`,
    });
    conversationLog.push(`User (${userLang}): ${prompt}`);
    try {
        const response = await openai.chat.completions.create({
            model: AI_MODEL,
            messages: messages,
            max_tokens: 180,
            temperature: 0.4,
        });
        const reply = response.choices?.[0]?.message?.content || "I'm having trouble thinking.";
        messages.push({ role: 'assistant', content: reply });
        conversationLog.push(`Shruti: ${reply}`);
        return reply;
    }
    catch (e) {
        process.stderr.write("LLM Error: " + e.message + "\n");
        if (userLang === 'kn') {
            return 'ಕ್ಷಮಿಸಿ, ಈಗ ಉತ್ತರಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ. ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಪ್ರಯತ್ನಿಸಿ.';
        }
        if (userLang === 'hi') {
            return 'क्षमा करें, अभी मैं जवाब नहीं दे पा रही हूँ। कृपया थोड़ी देर बाद कोशिश करें।';
        }
        return 'Sorry, I cannot answer right now. Please try again in a moment.';
    }
}
/** ElevenLabs multilingual TTS — last resort after Sarvam + HF. https://elevenlabs.io/docs/api-reference/text-to-speech/convert */
async function synthesizeElevenLabsTts(trimmed) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
        throw new Error('ELEVENLABS_API_KEY missing');
    }
    const voiceId = process.env.ELEVENLABS_VOICE_ID ?? 'Xb7hH8MSUJpSbSDYk0k2';
    const modelId = process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2';
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'xi-api-key': apiKey,
            Accept: 'audio/mpeg',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: trimmed,
            model_id: modelId,
            voice_settings: {
                stability: Number.parseFloat(process.env.ELEVENLABS_STABILITY ?? '0.5') || 0.5,
                similarity_boost: Number.parseFloat(process.env.ELEVENLABS_SIMILARITY ?? '0.75') || 0.75,
            },
        }),
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(`ElevenLabs HTTP ${res.status}: ${t.slice(0, 400)}`);
    }
    const mp3 = Buffer.from(await res.arrayBuffer());
    if (mp3.length < 32) {
        throw new Error('ElevenLabs response too small');
    }
    const mp3Path = '/tmp/tts_elevenlabs.mp3';
    const outWav = '/tmp/tts_asterisk.wav';
    fs.writeFileSync(mp3Path, mp3);
    await ffmpegToAsteriskWav(mp3Path, outWav);
    log('ElevenLabs → 8 kHz mono WAV, STREAM FILE…\n');
    const agiResult = agiCommand('STREAM FILE /tmp/tts_asterisk ""');
    log(`STREAM FILE AGI result: ${agiResult}\n`);
}
async function tryElevenLabsFallback(trimmed, ttsLang, reason) {
    if (!process.env.ELEVENLABS_API_KEY) {
        return false;
    }
    log(`TTS: ElevenLabs fallback (${reason}) lang=${ttsLang}\n`);
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            if (attempt > 0) {
                await new Promise((r) => setTimeout(r, 1200));
            }
            await synthesizeElevenLabsTts(trimmed);
            return true;
        }
        catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            log(`ElevenLabs attempt ${attempt + 1} failed: ${m}\n`);
        }
    }
    return false;
}
async function synthesizeMmsTts(trimmed, ttsLang, hfToken) {
    const model = TTS_MODELS_MMS[ttsLang];
    const client = new InferenceClient(hfToken);
    const blob = await client.textToSpeech({ model, inputs: trimmed });
    const buf = Buffer.from(await blob.arrayBuffer());
    if (buf.length < 64) {
        throw new Error('MMS TTS response too small');
    }
    return buf;
}
async function generateTTS(text, ttsLang) {
    const trimmed = text.trim();
    if (!trimmed) {
        return;
    }
    const hfToken = process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN;
    const preview = `${trimmed.slice(0, 80)}${trimmed.length > 80 ? '…' : ''}`;
    if (sarvamKey) {
        log(`Sarvam TTS lang=${ttsLang} text="${preview}"\n`);
        let sarvamErr = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                if (attempt > 0) {
                    await new Promise((r) => setTimeout(r, 1500 * attempt));
                }
                const buf = await synthesizeSarvamTts(trimmed, ttsLang, sarvamKey);
                log(`Sarvam TTS ok bytes=${buf.length}\n`);
                await playPcmAudioBufferToAsterisk(buf);
                return;
            }
            catch (e) {
                sarvamErr = e instanceof Error ? e : new Error(String(e));
                log(`Sarvam TTS attempt ${attempt + 1} failed: ${sarvamErr.message}\n`);
            }
        }
        log(`Sarvam TTS failed after retries — ${hfToken ? 'trying Hugging Face' : 'no HF_TOKEN'}\n`);
        if (!hfToken) {
            if (await tryElevenLabsFallback(trimmed, ttsLang, 'after Sarvam, no HF')) {
                return;
            }
            throw sarvamErr ?? new Error('Sarvam TTS failed; set ELEVENLABS_API_KEY or HF_TOKEN');
        }
    }
    if (!hfToken) {
        if (await tryElevenLabsFallback(trimmed, ttsLang, 'no HF token')) {
            return;
        }
        throw new Error('Set SARVAM_API_KEY, HF_TOKEN, or ELEVENLABS_API_KEY for TTS');
    }
    const engine = ttsEngine();
    log(`HF TTS engine=${engine} lang=${ttsLang} text="${preview}"\n`);
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            if (attempt > 0) {
                await new Promise((r) => setTimeout(r, 1500 * attempt));
            }
            let buf;
            if (engine === 'parler') {
                try {
                    buf = await synthesizeIndicParlerTts(trimmed, PARLER_CAPTIONS[ttsLang], hfToken, PARLER_MODEL_ID);
                    log(`Indic Parler-TTS ok bytes=${buf.length} model=${PARLER_MODEL_ID}\n`);
                }
                catch (pe) {
                    const pm = pe instanceof Error ? pe.message : String(pe);
                    log(`Indic Parler failed (${pm}) — falling back to MMS\n`);
                    buf = await synthesizeMmsTts(trimmed, ttsLang, hfToken);
                }
            }
            else {
                buf = await synthesizeMmsTts(trimmed, ttsLang, hfToken);
            }
            await playPcmAudioBufferToAsterisk(buf);
            return;
        }
        catch (e) {
            lastErr = e instanceof Error ? e : new Error(String(e));
            log(`HF TTS attempt ${attempt + 1} failed: ${lastErr.message}\n`);
        }
    }
    if (await tryElevenLabsFallback(trimmed, ttsLang, 'after Hugging Face failed')) {
        return;
    }
    throw lastErr ?? new Error('TTS failed: Sarvam/HF/ElevenLabs all unavailable or errored');
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
            log("Transcribing recorded utterance (Groq Whisper)...\n");
            const { text, lang: userLang } = await transcribeSTT(absWav);
            log(`User transcribed (${userLang}): "${text}"\n`);
            if (text && text.trim().length > 1) {
                log("Thinking about reply (Groq LLM)...\n");
                const reply = await askLLM(text, 'Ather 450X ~₹1.45L (indicative), range ~105 km, top speed ~90 km/h; 450S and Apex also available. Offer test rides and service info.', userLang);
                log(`AI replying: "${reply}"\n`);
                const speakLang = pickTtsLang(reply, userLang);
                try {
                    await generateTTS(reply, speakLang);
                }
                catch (te) {
                    log(`TTS error: ${te instanceof Error ? te.message : String(te)}\n`);
                    agiCommand('STREAM FILE hello-world ""');
                }
            }
        }
        catch (e) {
            log(`Record loop error: ${e instanceof Error ? e.message : String(e)}\n`);
            break;
        }
    }
}
async function transcribeSTT(wavFile) {
    if (sarvamKey) {
        try {
            log('STT: Sarvam (saaras/saarika) …\n');
            return await transcribeSarvam(wavFile, sarvamKey);
        }
        catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            log(`Sarvam STT failed (${m}) — falling back to Groq Whisper if configured\n`);
        }
    }
    if (!groqKey) {
        log('GROQ_API_KEY missing — cannot run Whisper on Groq\n');
        return { text: '', lang: 'kn' };
    }
    const whisperModel = 'whisper-large-v3';
    const audioRead = () => fs.createReadStream(wavFile);
    try {
        const tr = (await openai.audio.transcriptions.create({
            file: audioRead(),
            model: whisperModel,
            response_format: 'verbose_json',
            prompt: 'Ather, 450X, 450S, Apex, electric scooter, showroom. Kannada Hindi English mixed.',
        }));
        const text = tr.text ?? '';
        const lang = normalizeWhisperLang(tr.language, text);
        return { text, lang };
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log(`Whisper verbose_json failed (${msg}), trying plain json\n`);
        try {
            const tr2 = await openai.audio.transcriptions.create({
                file: audioRead(),
                model: whisperModel,
                prompt: 'Ather, 450X, 450S, Apex, electric scooter, showroom. Kannada Hindi English mixed.',
            });
            const text = tr2.text;
            return { text, lang: inferLangFromText(text) };
        }
        catch (e2) {
            const m2 = e2 instanceof Error ? e2.message : String(e2);
            log('STT Error: ' + m2 + '\n');
            return { text: '', lang: 'kn' };
        }
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
    const greetingMsg = 'ನಮಸ್ಕಾರ! ನಾನು ಅಥರ್ ಶೋರೂಮ್‌ನಿಂದ ಶ್ರುತಿ. ಇಂಗ್ಲಿಷ್, ಹಿಂದಿ ಅಥವಾ ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಬಹುದು. ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?';
    try {
        await generateTTS(greetingMsg, 'kn');
    }
    catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        log(`Greeting TTS failed: ${m} — playing built-in prompt\n`);
        agiCommand('STREAM FILE hello-world ""');
    }
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
                                log("Transcribing audio (Groq Whisper)...\n");
                                const { text, lang: userLang } = await transcribeSTT(tempWav);
                                log(`User transcribed (${userLang}): "${text}"\n`);
                                if (text && text.trim().length > 1) {
                                    log(`Thinking about reply (Groq LLM)...\n`);
                                    const reply = await askLLM(text, 'Ather 450X ~₹1.45L (indicative), range ~105 km, top speed ~90 km/h; 450S and Apex also available.', userLang);
                                    log(`AI replying: "${reply}"\n`);
                                    const speakLang = pickTtsLang(reply, userLang);
                                    try {
                                        await generateTTS(reply, speakLang);
                                    }
                                    catch (te) {
                                        log(`TTS error: ${te instanceof Error ? te.message : String(te)}\n`);
                                    }
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