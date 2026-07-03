#!/usr/bin/node
import fs from 'fs';
import { spawn } from 'child_process';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { prisma } from './utils/db.js';
// Load API keys
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
const AI_MODEL = 'gajendra:v1';
const openai = new OpenAI({
    apiKey: sarvamKey,
    baseURL: 'https://api.sarvam.ai',
    defaultHeaders: { 'api-subscription-key': sarvamKey }
});
let fullTranscript = [];
let userLang = null;
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
* CRITICAL: Your response MUST start with the language code (kn, hi, en) followed by a newline.

You are only a listener and data collector for the community accountability loop. Nothing more.`;
function log(msg) {
    try {
        fs.appendFileSync('/tmp/agent_debug.log', `[${new Date().toISOString()}] ${msg}\n`);
        process.stderr.write(msg + "\n");
    }
    catch { }
}
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
async function askLLM(prompt) {
    fullTranscript.push({ role: 'user', content: prompt });
    const messages = [
        { role: 'system', content: COMMUNITY_SUPPORT_PROMPT },
        ...fullTranscript.slice(-10)
    ];
    const completion = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: messages,
        max_tokens: 150,
    });
    const fullText = completion.choices[0]?.message?.content ?? 'en\nRepeat please?';
    fullTranscript.push({ role: 'assistant', content: fullText });
    const lines = fullText.split('\n');
    const tag = lines[0].trim().toLowerCase();
    const content = lines.slice(1).join('\n').trim();
    if (tag === 'kn' || tag === 'hi' || tag === 'en') {
        return { text: content || fullText, lang: tag };
    }
    return { text: fullText, lang: 'en' };
}
async function generateTTS(text, lang) {
    if (!sarvamKey) {
        log("No Sarvam Key for TTS");
        agiCommand('STREAM FILE hello-world ""');
        return;
    }
    try {
        const res = await fetch('https://api.sarvam.ai/text-to-speech', {
            method: 'POST',
            headers: { 'api-subscription-key': sarvamKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                target_language_code: lang === 'kn' ? 'kn-IN' :
                    lang === 'hi' ? 'hi-IN' : 'en-IN',
                model: 'bulbul:v3',
                speech_sample_rate: 8000,
                output_audio_codec: 'wav',
                speaker: (lang === 'kn') ? 'shruti' : 'neha'
            })
        });
        const data = await res.json();
        const buf = Buffer.from(data.audios[0], 'base64');
        const outWav = '/tmp/tts_asterisk.wav';
        fs.writeFileSync(outWav, buf);
        agiCommand(`STREAM FILE /tmp/tts_asterisk ""`);
    }
    catch (e) {
        log(`TTS Error: ${e.message}`);
    }
}
async function transcribeSTT(wavFile) {
    if (!sarvamKey)
        return { text: '' };
    try {
        const stats = fs.statSync(wavFile);
        if (stats.size < 100)
            return { text: '' };
        const form = new FormData();
        form.append('file', fs.createReadStream(wavFile), {
            filename: 'audio.wav',
            contentType: 'audio/wav'
        });
        form.append('model', 'saarika:v1');
        form.append('language_code', 'hi-IN');
        form.append('with_diarization', 'false');
        const response = await axios.post('https://api.sarvam.ai/speech-to-text', form, {
            headers: {
                'api-subscription-key': sarvamKey,
                ...form.getHeaders()
            }
        });
        return { text: response.data.transcript || '' };
    }
    catch (e) {
        log(`Sarvam STT Error: ${e.response?.data?.error || e.message}`);
        return { text: '' };
    }
}
async function finalizeCall(phone) {
    log(`Finalizing for ${phone}`);
    const transcriptText = fullTranscript.map(m => `${m.role}: ${m.content}`).join('\n');
    try {
        let customer = await prisma.customer.findUnique({ where: { phone } });
        if (!customer)
            customer = await prisma.customer.create({ data: { phone, name: 'Community Member', status: 'NEW' } });
        await prisma.call.create({
            data: {
                customerId: customer.id,
                transcript: transcriptText,
                summary: 'Community Support Complaint',
                intent: 'QUERY',
                type: 'INBOUND',
                duration: 0
            }
        });
    }
    catch (e) {
        log(`CRM Error: ${e.message}`);
    }
}
async function main() {
    // Read AGI Env
    const byte = Buffer.alloc(1);
    let line = '';
    while (true) {
        const n = fs.readSync(0, byte, 0, 1, null);
        if (n !== 1)
            break;
        if (byte[0] === 0x0a) {
            if (line === '')
                break;
            line = '';
        }
        else if (byte[0] !== undefined && byte[0] !== 0x0d)
            line += String.fromCharCode(byte[0]);
    }
    log("Agent Started");
    await generateTTS("ನಮಸ್ತೆ. ನೀವು ಇಂದು ಯಾವ ಹಂಚಿಕೆಯ ಸಂಪನ್ಮೂಲ ಸಮಸ್ಯೆ ಅಥವಾ ವ್ಯರ್ಥವನ್ನು ವರದಿ ಮಾಡುತ್ತಿದ್ದೀರಿ? ನೀರು, ವಿದ್ಯುತ್ ಅಥವಾ ಕಸ?", 'kn');
    let seq = 0;
    while (true) {
        const base = `/tmp/rec_${process.pid}_${++seq}`;
        const res = agiCommand(`RECORD FILE ${base} wav "" 10000 s=1`);
        if (res.includes('result=-1') && !res.includes('(writefile)'))
            break;
        const wav = `${base}.wav`;
        if (fs.existsSync(wav) && fs.statSync(wav).size > 1000) {
            const { text } = await transcribeSTT(wav);
            log(`User: ${text}`);
            if (text.length > 1) {
                const { text: reply, lang: detectedLang } = await askLLM(text);
                log(`AI (${detectedLang}): ${reply}`);
                userLang = detectedLang;
                await generateTTS(reply, userLang);
            }
        }
    }
    await finalizeCall("unknown");
}
main().catch(e => log(`Main Error: ${e.message}`));
//# sourceMappingURL=agent_eagi.js.map