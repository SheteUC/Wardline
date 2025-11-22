import { WebSocketServer, WebSocket } from 'ws';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { SpeechService } from '../services/speech.service';
import { callContextManager } from '../state-machine/call-context';
import { CallStateMachine } from '../state-machine/call-state-machine';

/**
 * Media stream event types from Twilio
 */
interface TwilioMediaEvent {
    event: 'connected' | 'start' | 'media' | 'stop';
    sequenceNumber?: string;
    streamSid?: string;
    callSid?: string;
    start?: {
        streamSid: string;
        callSid: string;
        mediaFormat: {
            encoding: string;
            sampleRate: number;
            channels: number;
        };
    };
    media?: {
        track: string;
        chunk: string;
        timestamp: string;
        payload: string; // base64 encoded mulaw audio
    };
}

/**
 * WebSocket server for Twilio Media Streams
 */
export class MediaStreamServer {
    private wss: WebSocketServer;
    private speechService: SpeechService;
    private activeStreams: Map<
        string,
        {
            ws: WebSocket;
            callSid: string;
            audioStream: sdk.PushAudioInputStream;
            recognizer: sdk.SpeechRecognizer;
        }
    > = new Map();

    constructor(wss: WebSocketServer) {
        this.wss = wss;
        this.speechService = new SpeechService();
        this.setupWebSocketServer();
    }

    /**
     * Setup WebSocket server handlers
     */
    private setupWebSocketServer(): void {
        this.wss.on('connection', (ws: WebSocket) => {
            console.log('🔌 WebSocket connection established');

            let callSid: string | null = null;
            let streamSid: string | null = null;

            ws.on('message', async (data: Buffer) => {
                try {
                    const event: TwilioMediaEvent = JSON.parse(data.toString());

                    switch (event.event) {
                        case 'connected':
                            console.log('✅ WebSocket connected');
                            break;

                        case 'start':
                            callSid = event.start!.callSid;
                            streamSid = event.start!.streamSid;
                            console.log(`🎙️ Media stream started: ${streamSid} for call ${callSid}`);

                            await this.handleStreamStart(ws, callSid, streamSid);
                            break;

                        case 'media':
                            if (callSid && streamSid) {
                                await this.handleMediaChunk(streamSid, event.media!);
                            }
                            break;

                        case 'stop':
                            console.log(`⏹️ Media stream stopped: ${streamSid}`);
                            if (streamSid) {
                                await this.handleStreamStop(streamSid);
                            }
                            break;
                    }
                } catch (error) {
                    console.error('Error processing WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                console.log('🔌 WebSocket connection closed');
                if (streamSid) {
                    this.handleStreamStop(streamSid);
                }
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });
        });

        console.log('✅ Media Stream WebSocket server initialized');
    }

    /**
     * Handle stream start
     */
    private async handleStreamStart(
        ws: WebSocket,
        callSid: string,
        streamSid: string
    ): Promise<void> {
        // Create push audio stream for Azure Speech
        const audioStream = this.speechService.createPushAudioStream();

        // Start speech recognition
        const recognizer = await this.speechService.recognizeFromStream(
            audioStream,
            async (text: string, isFinal: boolean) => {
                if (isFinal) {
                    console.log(`📝 Final transcript: ${text}`);

                    // Process through state machine
                    const context = callContextManager.getContext(callSid);
                    if (context) {
                        const stateMachine = new CallStateMachine(context);
                        await stateMachine.handleInput(text);

                        // Generate response and send back to caller
                        const lastResponse = context.conversationHistory
                            .filter((m) => m.role === 'assistant')
                            .pop();

                        if (lastResponse) {
                            await this.sendAudioToCaller(ws, lastResponse.content);
                        }
                    }
                }
            },
            (error: string) => {
                console.error('STT Error:', error);
            }
        );

        // Store active stream
        this.activeStreams.set(streamSid, {
            ws,
            callSid,
            audioStream,
            recognizer,
        });

        console.log(`✅ Speech recognition started for stream ${streamSid}`);
    }

    /**
     * Handle incoming media chunk
     */
    private async handleMediaChunk(
        streamSid: string,
        media: TwilioMediaEvent['media']
    ): Promise<void> {
        const stream = this.activeStreams.get(streamSid);
        if (!stream) {
            console.warn(`No active stream found for ${streamSid}`);
            return;
        }

        // Decode base64 mulaw audio
        const mulawBuffer = Buffer.from(media!.payload, 'base64');

        // Convert mulaw to PCM (Azure Speech expects PCM)
        const pcmBuffer = this.mulawToPcm(mulawBuffer);

        // Push to Azure Speech STT
        stream.audioStream.write(pcmBuffer.buffer as ArrayBuffer);
    }

    /**
     * Handle stream stop
     */
    private async handleStreamStop(streamSid: string): Promise<void> {
        const stream = this.activeStreams.get(streamSid);
        if (!stream) {
            return;
        }

        // Stop recognition
        await stream.recognizer.stopContinuousRecognitionAsync();
        stream.audioStream.close();

        this.activeStreams.delete(streamSid);
        console.log(`🗑️ Cleaned up stream ${streamSid}`);
    }

    /**
     * Send audio response to caller via WebSocket
     */
    private async sendAudioToCaller(ws: WebSocket, text: string): Promise<void> {
        try {
            // Synthesize speech
            const audioBuffer = await this.speechService.synthesizeSpeech(text);

            // Convert PCM to mulaw for Twilio
            const mulawBuffer = this.pcmToMulaw(audioBuffer);

            // Send as base64 encoded media events to Twilio
            const chunk = mulawBuffer.toString('base64');

            const mediaEvent = {
                event: 'media',
                streamSid: 'outbound', // Twilio will handle this
                media: {
                    payload: chunk,
                },
            };

            ws.send(JSON.stringify(mediaEvent));
            console.log(`🔊 Sent audio response to caller`);
        } catch (error) {
            console.error('Error sending audio to caller:', error);
        }
    }

    /**
     * Convert mulaw to PCM
     */
    private mulawToPcm(mulawBuffer: Buffer): Buffer {
        // Simple mulaw to PCM conversion (16-bit)
        const pcmBuffer = Buffer.alloc(mulawBuffer.length * 2);

        for (let i = 0; i < mulawBuffer.length; i++) {
            const mulaw = mulawBuffer[i];
            const pcm = this.mulawToPcmSample(mulaw);
            pcmBuffer.writeInt16LE(pcm, i * 2);
        }

        return pcmBuffer;
    }

    /**
     * Convert single mulaw sample to PCM
     */
    private mulawToPcmSample(mulaw: number): number {
        const MULAW_BIAS = 33;
        const ulawByte = ~mulaw;
        const sign = ulawByte & 0x80;
        const exponent = (ulawByte >> 4) & 0x07;
        const mantissa = ulawByte & 0x0f;
        const sample = (mantissa << (exponent + 3)) + (MULAW_BIAS << exponent);
        return sign ? -sample : sample;
    }

    /**
     * Convert PCM to mulaw
     */
    private pcmToMulaw(pcmBuffer: Buffer): Buffer {
        const mulawBuffer = Buffer.alloc(pcmBuffer.length / 2);

        for (let i = 0; i < pcmBuffer.length; i += 2) {
            const pcm = pcmBuffer.readInt16LE(i);
            const mulaw = this.pcmToMulawSample(pcm);
            mulawBuffer[i / 2] = mulaw;
        }

        return mulawBuffer;
    }

    /**
     * Convert single PCM sample to mulaw
     */
    private pcmToMulawSample(pcm: number): number {
        const MULAW_MAX = 0x1fff;
        const MULAW_BIAS = 33;

        let sign = (pcm >> 8) & 0x80;
        if (sign) pcm = -pcm;
        if (pcm > MULAW_MAX) pcm = MULAW_MAX;

        pcm += MULAW_BIAS;
        let exponent = 7;
        for (let expMask = 0x4000; (pcm & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) { }

        const mantissa = (pcm >> (exponent + 3)) & 0x0f;
        const mulaw = ~(sign | (exponent << 4) | mantissa);

        return mulaw & 0xff;
    }

    /**
     * Close WebSocket server
     */
    public close(): void {
        // Stop all active streams
        for (const [, stream] of this.activeStreams.entries()) {
            stream.recognizer.stopContinuousRecognitionAsync();
            stream.audioStream.close();
        }

        this.activeStreams.clear();
        console.log('✅ Media Stream server closed');
    }
}
