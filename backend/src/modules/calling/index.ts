import twilio from 'twilio';
import dotenv from 'dotenv';
import * as ai from '../../utils/ai';
import * as crm from '../crm';

dotenv.config();

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

export const init = async () => {
    console.log('📞 Voice Call Module initialized.');
};

// Outbound AI Call
export const initiateOutboundCall = async (phoneNumber: string, name: string) => {
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
