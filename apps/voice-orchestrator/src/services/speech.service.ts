import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { config } from '../config';

/**
 * Azure Speech service for STT and TTS
 */
export class SpeechService {
    private speechConfig: sdk.SpeechConfig;

    constructor() {
        this.speechConfig = sdk.SpeechConfig.fromSubscription(
            config.azureSpeech.key,
            config.azureSpeech.region
        );

        // Configure speech recognition
        this.speechConfig.speechRecognitionLanguage = 'en-US';

        // Configure TTS voice
        this.speechConfig.speechSynthesisVoiceName = 'en-US-JennyNeural';
        
        // Configure TTS output format for Twilio (8kHz, 16-bit PCM)
        // We'll convert to mulaw after
        this.speechConfig.speechSynthesisOutputFormat = 
            sdk.SpeechSynthesisOutputFormat.Raw8Khz16BitMonoPcm;
    }

    /**
     * Create push audio stream for real-time STT
     */
    public createPushAudioStream(): sdk.PushAudioInputStream {
        const audioFormat = sdk.AudioStreamFormat.getWaveFormatPCM(8000, 16, 1);
        return sdk.AudioInputStream.createPushStream(audioFormat);
    }

    /**
     * Recognize speech from audio stream
     */
    public async recognizeFromStream(
        audioStream: sdk.PushAudioInputStream,
        onResult: (text: string, isFinal: boolean) => void,
        onError: (error: string) => void
    ): Promise<sdk.SpeechRecognizer> {
        const audioConfig = sdk.AudioConfig.fromStreamInput(audioStream);
        const recognizer = new sdk.SpeechRecognizer(this.speechConfig, audioConfig);

        // Interim results
        recognizer.recognizing = (_s, e) => {
            if (e.result.reason === sdk.ResultReason.RecognizingSpeech) {
                console.log(`[STT Interim] ${e.result.text}`);
                onResult(e.result.text, false);
            }
        };

        // Final results
        recognizer.recognized = (_s, e) => {
            if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
                console.log(`[STT Final] ${e.result.text}`);
                onResult(e.result.text, true);
            }
        };

        // Errors
        recognizer.canceled = (_s, e) => {
            console.error(`[STT Error] ${e.errorDetails}`);
            onError(e.errorDetails);
            recognizer.stopContinuousRecognitionAsync();
        };

        // Start continuous recognition
        await recognizer.startContinuousRecognitionAsync();

        console.log('🎤 Started speech recognition');

        return recognizer;
    }

    /**
     * Synthesize speech from text (TTS)
     */
    public async synthesizeSpeech(text: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);

            synthesizer.speakTextAsync(
                text,
                (result) => {
                    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                        console.log(`[TTS] Synthesized ${result.audioData.byteLength} bytes`);
                        resolve(Buffer.from(result.audioData));
                    } else {
                        reject(new Error(`TTS failed: ${result.errorDetails}`));
                    }
                    synthesizer.close();
                },
                (error) => {
                    console.error('[TTS Error]', error);
                    synthesizer.close();
                    reject(error);
                }
            );
        });
    }

    /**
     * Synthesize speech with SSML for better control
     */
    public async synthesizeSpeechSSML(ssml: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);

            synthesizer.speakSsmlAsync(
                ssml,
                (result) => {
                    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                        console.log(`[TTS SSML] Synthesized ${result.audioData.byteLength} bytes`);
                        resolve(Buffer.from(result.audioData));
                    } else {
                        reject(new Error(`TTS SSML failed: ${result.errorDetails}`));
                    }
                    synthesizer.close();
                },
                (error) => {
                    console.error('[TTS SSML Error]', error);
                    synthesizer.close();
                    reject(error);
                }
            );
        });
    }

    /**
     * Generate SSML with prosody control
     */
    public generateSSML(
        text: string,
        options: {
            rate?: string;
            pitch?: string;
            volume?: string;
        } = {}
    ): string {
        const { rate = 'medium', pitch = 'medium', volume = 'medium' } = options;

        return `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
        <voice name="en-US-JennyNeural">
          <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">
            ${text}
          </prosody>
        </voice>
      </speak>
    `.trim();
    }
}
