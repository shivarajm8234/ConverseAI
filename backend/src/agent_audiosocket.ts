import net from 'net';
import WebSocket from 'ws';
import fs from 'fs';
import { spawn } from 'child_process';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { prisma } from './utils/db.js';
import { getKnowledgeContext, searchVectorStore, openai as aiClient } from './utils/ai.js';

// Use chatModel from ai.ts (will use Groq if available)
import { chatModel } from './utils/ai.js';

dotenv.config();

const sarvamKey = process.env.SARVAM_API_KEY;
const PORT = 9092;

type LangCode = 'kn-IN' | 'hi-IN' | 'en-IN';

interface CallState {
    transcript: string;
    lang: LangCode;
    isAiTalking: boolean;
    abortController: AbortController | null;
    startTime: number;
    hasDetectedLanguage: boolean;
}

function createAudioFrame(payload: Buffer): Buffer {
    const header = Buffer.alloc(3);
    header[0] = 0x01; // Audio
    header.writeUInt16BE(payload.length, 1);
    return Buffer.concat([header, payload]);
}

async function generateTTS(text: string, lang: LangCode): Promise<Buffer | null> {
    if (!sarvamKey) return null;
    try {
        // Speaker Mapping for premium voices
        const speakerMap: Record<LangCode, string> = {
            'kn-IN': 'shruti',
            'hi-IN': 'neha',
            'en-IN': 'neha' // 'neha' or 'vatsala' for English
        };

        const res = await fetch('https://api.sarvam.ai/text-to-speech', {
            method: 'POST',
            headers: { 'api-subscription-key': sarvamKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                target_language_code: lang,
                model: 'bulbul:v3',
                speech_sample_rate: 8000,
                output_audio_codec: 'pcm',
                speaker: speakerMap[lang] || 'shruti'
            })
        });
        const data: any = await res.json();
        if (data.audios && data.audios[0]) {
            return Buffer.from(data.audios[0], 'base64');
        }
    } catch (e) {
        console.error('TTS Error:', e);
    }
    return null;
}

async function* askLLMStream(prompt: string, context: string, currentLang: LangCode) {
    const systemPrompt = `You are Shruti, the official AI Voice Assistant for Ather Energy. 
Support languages: Kannada (kn-IN), Hindi (hi-IN), English (en-IN).

KNOWLEDGE BASE:
${context}

Instructions:
1. USE THE KNOWLEDGE BASE ABOVE. If the information is there, you MUST use it. Do not use general facts if specific facts are provided.
2. Respond in the EXACT language the user is speaking. If they change language, you MUST change with them.
3. CRITICAL: All numbers, prices, and technical specifications (range, top speed, battery capacity, dates) MUST be written in English (e.g., "1.4 lakh", "150 km range").
4. Be professional, helpful, and concise (20-45 words).
5. Use plain text only. No markdown.
6. CRITICAL: Your response MUST start with the language code (kn-IN, hi-IN, en-IN, ta-IN, te-IN, mr-IN, ml-IN, bn-IN, gu-IN, pa-IN, or-IN) followed by a newline.
7. If you are unsure of the language, default to en-IN.`;

    try {
        const stream = await aiClient.chat.completions.create({
            model: chatModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
            temperature: 0.5,
            stream: true,
        });
        for await (const chunk of stream) {
            yield chunk.choices[0]?.delta?.content || '';
        }
    } catch (e) {
        console.error('LLM Error:', e);
        yield `${currentLang}\nI am sorry, I encountered an error. How else can I help you?`;
    }
}

const server = net.createServer((socket) => {
    const callId = Math.random().toString(36).substring(7);
    console.log(`[${callId}] 📞 Real-time Call Connected`);

    const state: CallState = {
        transcript: '',
        lang: 'kn-IN',
        isAiTalking: false,
        abortController: null,
        startTime: Date.now(),
        hasDetectedLanguage: false
    };

    let audioBuffer = Buffer.alloc(0);
    let sarvamWs: WebSocket | null = null;

    const startStreaming = (lang: LangCode) => {
        if (!sarvamKey) return;
        state.lang = lang;
        if (sarvamWs) {
            sarvamWs.removeAllListeners();
            sarvamWs.close();
        }

        sarvamWs = new WebSocket('wss://api.sarvam.ai/speech-to-text/ws');

        sarvamWs.on('open', () => {
            sarvamWs?.send(JSON.stringify({
                config: {
                    language_code: lang,
                    model: 'saarika:v1',
                    encoding: 'LINEAR16',
                    sample_rate: 8000
                }
            }));
        });

        sarvamWs.on('message', async (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.transcript && msg.is_final) {
                const userText = msg.transcript.trim();
                if (userText.length < 2) return;

                console.log(`👤 [${callId}] User [${state.lang}]: ${userText}`);
                state.transcript += `User: ${userText}\n`;

                if (state.isAiTalking && state.abortController) {
                    state.abortController.abort();
                }

                state.isAiTalking = true;
                state.abortController = new AbortController();
                const signal = state.abortController.signal;

                try {
                    // Start vector search in parallel
                    const contextPromise = searchVectorStore(userText, 3);
                    const context = await contextPromise;

                    const llmStream = askLLMStream(userText, context, state.lang);

                    let detectedLang: LangCode = state.lang;
                    let fullReply = '';
                    let currentSentence = '';
                    let hasParsedLang = false;
                    let firstLine = '';

                    for await (const chunk of llmStream) {
                        if (signal.aborted) break;
                        fullReply += chunk;

                        if (!hasParsedLang) {
                            firstLine += chunk;
                            // Check for newline OR if firstLine is getting too long (tag missing)
                            if (firstLine.includes('\n') || firstLine.length > 10) {
                                hasParsedLang = true;
                                const parts = firstLine.split('\n');
                                const tagMatch = parts[0].trim().match(/^(kn-IN|hi-IN|en-IN)/);

                                if (tagMatch) {
                                    detectedLang = tagMatch[1] as LangCode;
                                    currentSentence = parts.slice(1).join('\n');

                                    if (detectedLang !== state.lang) {
                                        console.log(`🌍 [${callId}] Switching to: ${detectedLang}`);
                                        state.lang = detectedLang;
                                        startStreaming(detectedLang);
                                    }
                                } else {
                                    // Tag missing, assume current language and treat firstLine as content
                                    currentSentence = firstLine;
                                }
                            }
                            continue;
                        }

                        currentSentence += chunk;
                        // Sentence enders: . ! ? or newline or Marathi/Hindi sentence ender ।
                        if (/[.!?\n।]/.test(currentSentence)) {
                            const sentences = currentSentence.split(/(?<=[.!?\n।] )/);
                            if (sentences.length > 1) {
                                currentSentence = sentences.pop() || '';
                                for (const s of sentences) {
                                    const trimmed = s.trim();
                                    if (trimmed.length > 1) {
                                        await playAudio(socket, trimmed, detectedLang, state, signal);
                                    }
                                }
                            }
                        }
                    }

                    if (!signal.aborted && currentSentence.trim().length > 2) {
                        await playAudio(socket, currentSentence.trim(), detectedLang, state, signal);
                    }

                    state.transcript += `AI: ${fullReply.split('\n').slice(1).join(' ')}\n`;

                } catch (e) {
                    console.error(`[${callId}] Processing error:`, e);
                } finally {
                    state.isAiTalking = false;
                }
            }
        });
    };

    async function playAudio(socket: net.Socket, text: string, lang: LangCode, state: CallState, signal: AbortSignal) {
        if (signal.aborted) return;
        console.log(`🤖 [${callId}] AI (${lang}): ${text}`);
        const audio = await generateTTS(text, lang);
        if (audio && !signal.aborted) {
            const CHUNK_SIZE = 1600;
            for (let i = 0; i < audio.length; i += CHUNK_SIZE) {
                if (signal.aborted) break;
                socket.write(createAudioFrame(audio.slice(i, i + CHUNK_SIZE)));
                await new Promise(r => setTimeout(r, 40));
            }
        }
    }

    // Start with Multilingual discovery
    startStreaming('en-IN');

    socket.on('data', (data) => {
        audioBuffer = Buffer.concat([audioBuffer, data]);
        while (audioBuffer.length >= 3) {
            const type = audioBuffer[0];
            const len = audioBuffer.readUInt16BE(1);
            if (audioBuffer.length < 3 + len) break;
            const payload = audioBuffer.slice(3, 3 + len);
            audioBuffer = audioBuffer.slice(3 + len);
            if (type === 0x01 && sarvamWs?.readyState === WebSocket.OPEN) {
                sarvamWs.send(payload);
            }
        }
    });

    socket.on('close', async () => {
        console.log(`[${callId}] 📴 Call Ended`);
        sarvamWs?.close();
        if (state.transcript.length > 5) {
            try {
                const duration = Math.floor((Date.now() - state.startTime) / 1000);
                const customer = await prisma.customer.findFirst({ where: { phone: 'WebRTC' } })
                    || await prisma.customer.create({ data: { phone: 'WebRTC', name: 'Web User' } });

                await prisma.call.create({
                    data: {
                        customerId: customer.id,
                        transcript: state.transcript,
                        summary: 'Production AI Call',
                        type: 'INBOUND',
                        duration: duration,
                        intent: 'GENERAL_QUERY'
                    }
                });
            } catch (e) {
                console.error(`[${callId}] DB Error:`, e);
            }
        }
    });

    socket.on('error', console.error);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Secure AI Core listening on port ${PORT}`);
});
