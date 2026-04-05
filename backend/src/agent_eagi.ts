#!/usr/bin/node
import fs from 'fs';
import { spawn } from 'child_process';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { InferenceClient } from '@huggingface/inference';
import { prisma } from './utils/db.js';
import { getKnowledgeContext } from './utils/ai.js';

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

const groqKey = process.env.GROQ_API_KEY;
const openai = new OpenAI({
    apiKey: groqKey || process.env.OPENAI_API_KEY,
    baseURL: groqKey ? "https://api.groq.com/openai/v1" : undefined
});
const AI_MODEL = groqKey ? (process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile") : "gpt-4o-mini";
const sarvamKey = process.env.SARVAM_API_KEY;

type LangCode = 'kn' | 'hi' | 'en';

let activeKnowledgeCache = "Ather 450X price is Rs 1,45,000, 105km range, 90kmph top speed. Rizta family scooter available.";
let fullTranscript = '';

function log(msg: string) {
    try {
        fs.appendFileSync('/tmp/agent_debug.log', `[${new Date().toISOString()}] ${msg}\n`);
        process.stderr.write(msg + "\n");
    } catch {}
}

function agiCommand(cmd: string): string {
    process.stdout.write(`${cmd}\n`);
    const b = Buffer.alloc(1);
    let acc = '';
    while (true) {
        const n = fs.readSync(0, b, 0, 1, null);
        if (n !== 1) return 'EOF';
        const ch = b.readUInt8(0);
        if (ch === 0x0a) {
            const line = acc.trimEnd();
            acc = '';
            if (line === '') continue;
            if (/^\d{3}\s/.test(line)) return line;
            continue;
        }
        if (ch !== 0x0d) acc += String.fromCharCode(ch);
    }
}

async function prefetchKnowledge() {
    try {
        activeKnowledgeCache = await getKnowledgeContext();
        log("🧠 Knowledge Prefetched.");
    } catch (e) {
        log("⚠️ Knowledge Prefetch Failed.");
    }
}

async function askLLM(prompt: string, context: string, userLang: LangCode) {
    const systemPromptMap: Record<LangCode, string> = {
        kn: 'ನೀವು ಅಥರ್ ಎನರ್ಜಿ ಶೋರೂಮ್‌ನ ಇವಿ ಅಸಿಸ್ಟೆಂಟ್ ಶೃತಿ. ಗ್ರಾಹಕರಿಗೆ ಸಣ್ಣ ಉತ್ತರ ನೀಡಿ.',
        hi: 'आप एथर एनर्जी शोरूम की ईवी सहायक श्रुति हैं। संक्षिप्त उत्तर दें।',
        en: 'You are Shruti, an EV Assistant at Ather Energy. Keep answers very concise (under 30 words).',
    };
    const completion = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
            { role: 'system', content: `${systemPromptMap[userLang] || systemPromptMap.en} Context: ${context}` },
            { role: 'user', content: prompt },
        ],
        max_tokens: 100,
    });
    return completion.choices[0]?.message?.content ?? 'Repeat please?';
}

async function generateTTS(text: string, lang: LangCode) {
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
                target_language_code: lang === 'kn' ? 'kn-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN',
                model: 'bulbul:v3',
                speech_sample_rate: 8000,
                output_audio_codec: 'wav',
                speaker: lang === 'kn' ? 'shruti' : 'neha'
            })
        });
        const data: any = await res.json();
        const buf = Buffer.from(data.audios[0], 'base64');
        const outWav = '/tmp/tts_asterisk.wav';
        fs.writeFileSync(outWav, buf);
        agiCommand(`STREAM FILE /tmp/tts_asterisk ""`);
    } catch (e: any) {
        log(`TTS Error: ${e.message}`);
    }
}

async function transcribeSTT(wavFile: string): Promise<{ text: string; lang: LangCode }> {
    try {
        const tr = await openai.audio.transcriptions.create({
            file: fs.createReadStream(wavFile) as any,
            model: 'whisper-large-v3',
            response_format: 'verbose_json',
        });
        const text = tr.text ?? '';
        const lang = (tr as any).language === 'kannada' ? 'kn' : (tr as any).language === 'hindi' ? 'hi' : 'en';
        return { text, lang: lang as LangCode };
    } catch (e: any) {
        log(`STT Error: ${e.message}`);
        return { text: '', lang: 'kn' };
    }
}

async function finalizeCall(phone: string) {
    log(`Finalizing for ${phone}`);
    const summaryRes = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [{ role: 'system', content: 'Summarize the conversation: {"summary": "...", "followUp": "..."}' }, { role: 'user', content: fullTranscript }],
        response_format: { type: 'json_object' }
    });
    const summary = JSON.parse(summaryRes.choices[0].message.content || '{}');
    try {
        let customer = await prisma.customer.findUnique({ where: { phone } });
        if (!customer) customer = await prisma.customer.create({ data: { phone, name: 'Guest', status: 'NEW' } });
        const isBooking = /book|appointment|test ride/i.test(fullTranscript);
        await prisma.call.create({
            data: {
                customerId: customer.id,
                transcript: fullTranscript,
                summary: summary.summary,
                followUpPlan: summary.followUp,
                intent: isBooking ? 'BOOKING' : 'QUERY',
                type: 'INBOUND',
                duration: 0
            }
        });
        if (isBooking) await prisma.customer.update({ where: { id: customer.id }, data: { status: 'WARM' } });
    } catch (e: any) { log(`CRM Error: ${e.message}`); }
}

async function main() {
    // Read AGI Env
    const byte = Buffer.alloc(1);
    let line = '';
    while (true) {
        const n = fs.readSync(0, byte, 0, 1, null);
        if (n !== 1) break;
        if (byte[0] === 0x0a) {
            if (line === '') break;
            line = '';
        } else if (byte[0] !== 0x0d) line += String.fromCharCode(byte[0]);
    }

    log("Agent Started");
    await prefetchKnowledge();
    await generateTTS("ನಮಸ್ಕಾರ! ನಾನು ಅಥರ್ ಶೋರೂಮ್‌ನಿಂದ ಶೃತಿ. ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?", 'kn');

    let seq = 0;
    while (true) {
        const base = `/tmp/rec_${process.pid}_${++seq}`;
        const res = agiCommand(`RECORD FILE ${base} wav "" 10000 s=2`);
        if (res.includes('result=-1') && !res.includes('(writefile)')) break;
        
        const wav = `${base}.wav`;
        if (fs.existsSync(wav) && fs.statSync(wav).size > 1000) {
            const { text, lang } = await transcribeSTT(wav);
            log(`User: ${text}`);
            if (text.length > 1) {
                const reply = await askLLM(text, activeKnowledgeCache, lang);
                log(`AI: ${reply}`);
                fullTranscript += `User: ${text}\nAI: ${reply}\n`;
                await generateTTS(reply, lang);
            }
        }
    }
    await finalizeCall("unknown");
}

main().catch(e => log(`Main Error: ${e.message}`));
