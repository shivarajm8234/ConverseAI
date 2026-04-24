import twilio from 'twilio';
import dotenv from 'dotenv';
import axios from 'axios';
import * as ai from '../../utils/ai.js';
import * as crm from '../crm/index.js';

dotenv.config();

let client: twilio.Twilio | null = null;
if (process.env.TWILIO_SID && process.env.TWILIO_SID.startsWith('AC') && process.env.TWILIO_AUTH_TOKEN) {
    client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
}

/**
 * Automatically fetch the public IP address of the server.
 */
async function getPublicIP(): Promise<string | null> {
    try {
        const response = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
        return response.data.ip;
    } catch (error) {
        console.error('⚠️ Failed to fetch public IP automatically:', (error as Error).message);
        return null;
    }
}

export const init = async () => {
    // Automatically resolve PUBLIC_IP if it's the placeholder or empty
    const currentIP = process.env.PUBLIC_IP;
    if (!currentIP || currentIP === 'your-public-ip-or-ngrok' || currentIP.trim() === '') {
        console.log('🔍 PUBLIC_IP not set, attempting to fetch automatically...');
        const detectedIP = await getPublicIP();
        if (detectedIP) {
            process.env.PUBLIC_IP = detectedIP;
            console.log(`🌐 Automatically detected Public IP: ${detectedIP}`);
        } else {
            console.warn('⚠️ Could not detect Public IP. Calls may fail unless PUBLIC_IP is set in .env');
        }
    }

    if (client) {
        console.log('📞 Voice Call Module initialized (Twilio).');
    } else {
        console.warn('⚠️ TWILIO credentials missing or invalid (must start with AC). Call features disabled.');
    }
};

// Outbound AI Call
export const initiateOutboundCall = async (phoneNumber: string, name: string) => {
    if (!client) {
        throw new Error('Twilio client not initialized. Check your TWILIO_SID and AUTH_TOKEN.');
    }
    try {
        const call = await client.calls.create({
            url: `http://${process.env.PUBLIC_IP}/voice/inbound-ivr?name=${encodeURIComponent(name)}`,
            to: phoneNumber,
            from: process.env.TWILIO_PHONE_NUMBER || '',
        });
        console.log(`📡 Call initiated to ${name} at ${phoneNumber} (ID: ${call.sid})`);
        return call.sid;
    } catch (error) {
        console.error('Call initialization failed:', error);
        throw error;
    }
};

// STT Processing and Intent Extraction
export const handleCallTranscript = async (callId: string, customerId: string, transcript: string) => {
    const analysis = await ai.extractIntent(transcript);

    // Update CRM based on call analysis
    await crm.updateLeadFromCall(customerId, analysis);

    // Store call history
    // await prisma.call.create({
    //     data: {
    //         customerId,
    //         transcript,
    //         intent: analysis.intent,
    //         sentiment: analysis.sentiment,
    //         importantInfo: analysis.importantInfo
    //     }
    // });

    console.log(`📞 Call ${callId} processed. Intent: ${analysis.intent}`);
};

// IP Telephony / Forwarding Logic
export const forwardCall = (ctx: any, targetNumber: string) => {
    const response = new twilio.twiml.VoiceResponse();
    response.say('Connecting you to a representative.');
    response.dial(targetNumber);
    return response.toString();
};
