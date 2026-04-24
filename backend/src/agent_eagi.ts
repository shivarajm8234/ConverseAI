#!/usr/bin/node
import fs from 'fs';
import { spawn } from 'child_process';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { InferenceClient } from '@huggingface/inference';
import axios from 'axios';
import FormData from 'form-data';
import { prisma } from './utils/db.js';
import { getKnowledgeContext, searchVectorStore, chatModel, openai as aiClient } from './utils/ai.js';

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
const AI_MODEL = chatModel;
const openai = aiClient;

type LangCode = 'kn' | 'hi' | 'en' | 'ta' | 'te' | 'mr' | 'ml' | 'bn' | 'gu' | 'pa' | 'or';

let fullTranscript = '';
let userLang: LangCode = 'en';

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

async function askLLM(prompt: string, context: string): Promise<{ text: string, lang: LangCode }> {
    const systemPrompt = `You are Shruti, the official AI Voice Assistant for Ather Energy.
You support: English, Hindi, Kannada, Tamil, Telugu, Marathi, Malayalam, Bengali, Gujarati, Punjabi, and Odia.

KNOWLEDGE BASE:
${context}

Instructions:
1. USE THE KNOWLEDGE BASE ABOVE. If the user asks for details (price, range, models), you MUST use the facts from the Knowledge Base.
2. Respond in the EXACT language the user is speaking. If they change language, you MUST change with them.
3. CRITICAL: All numbers, prices, and technical specifications MUST be written in English (e.g., "1.4 lakh", "150 km range").
4. Be professional, helpful, and concise (20-45 words).
5. Use plain text only. No markdown.
6. Your response MUST start with the language code (kn, hi, en, ta, te, mr, ml, bn, gu, pa, or) followed by a newline.

Example:
kn
ಅಥರ್ 450X ಬೆಲೆ 1.4 lakh ರೂಪಾಯಿ.`;

    const completion = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
        ],
        max_tokens: 150,
    });
    
    const fullText = completion.choices[0]?.message?.content ?? 'en\nRepeat please?';
    const lines = fullText.split('\n');
    const tag = lines[0].trim().toLowerCase() as LangCode;
    const content = lines.slice(1).join('\n').trim();
    
    const validTags: LangCode[] = ['kn', 'hi', 'en', 'ta', 'te', 'mr', 'ml', 'bn', 'gu', 'pa', 'or'];
    if (validTags.includes(tag)) {
        return { text: content || fullText, lang: tag };
    }
    return { text: fullText, lang: 'en' };
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
                target_language_code: 
                    lang === 'kn' ? 'kn-IN' : 
                    lang === 'hi' ? 'hi-IN' : 
                    lang === 'ta' ? 'ta-IN' : 
                    lang === 'te' ? 'te-IN' : 
                    lang === 'mr' ? 'mr-IN' : 
                    lang === 'ml' ? 'ml-IN' : 
                    lang === 'bn' ? 'bn-IN' : 
                    lang === 'gu' ? 'gu-IN' : 
                    lang === 'pa' ? 'pa-IN' : 
                    lang === 'or' ? 'or-IN' : 'en-IN',
                model: 'bulbul:v3',
                speech_sample_rate: 8000,
                output_audio_codec: 'wav',
                speaker: (lang === 'kn') ? 'shruti' : (lang === 'hi' || lang === 'en') ? 'neha' : 'vani'
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

async function transcribeSTT(wavFile: string): Promise<{ text: string }> {
    if (!sarvamKey) return { text: '' };
    try {
        const form = new FormData();
        form.append('file', fs.createReadStream(wavFile));
        form.append('model', 'saarika:v1');
        
        const response = await axios.post('https://api.sarvam.ai/speech-to-text', form, {
            headers: {
                'api-subscription-key': sarvamKey,
                ...form.getHeaders()
            }
        });
        
        return { text: response.data.transcript || '' };
    } catch (e: any) {
        log(`Sarvam STT Error: ${e.message}`);
        return { text: '' };
    }
}

async function finalizeCall(phone: string) {
    log(`Finalizing for ${phone}`);
    const summaryRes = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [{ role: 'system', content: 'Summarize the conversation: {"summary": "...", "followUp": "..."}' }, { role: 'user', content: fullTranscript }],
        response_format: { type: 'json_object' }
    });
    const summary = JSON.parse(summaryRes.choices?.[0]?.message?.content || '{}');
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
        } else if (byte[0] !== undefined && byte[0] !== 0x0d) line += String.fromCharCode(byte[0]);
    }

    log("Agent Started");
    await generateTTS("Hello! I am Shruti from Ather Energy. How can I help you today?", 'en');

    let seq = 0;
    while (true) {
        const base = `/tmp/rec_${process.pid}_${++seq}`;
        const res = agiCommand(`RECORD FILE ${base} wav "" 10000 s=2`);
        if (res.includes('result=-1') && !res.includes('(writefile)')) break;
        
        const wav = `${base}.wav`;
        if (fs.existsSync(wav) && fs.statSync(wav).size > 1000) {
            const { text } = await transcribeSTT(wav);
            log(`User: ${text}`);
            if (text.length > 1) {
                // INTEGRATED KNOWLEDGE SEARCH
                const context = await searchVectorStore(text, 3);
                const { text: reply, lang: detectedLang } = await askLLM(text, context);
                
                log(`AI (${detectedLang}): ${reply}`);
                userLang = detectedLang;
                fullTranscript += `User: ${text}\nAI: ${reply}\n`;
                await generateTTS(reply, userLang);
            }
        }
    }
    await finalizeCall("unknown");
}

main().catch(e => log(`Main Error: ${e.message}`));
