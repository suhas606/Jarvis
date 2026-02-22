import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export class JarvisVoiceService {
  private ai: GoogleGenAI;
  private session: any = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private audioQueue: Int16Array[] = [];
  private isPlaying = false;
  private nextStartTime = 0;
  private isMuted = false;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async connect(callbacks: {
    onMessage?: (text: string) => void;
    onStatusChange?: (status: string) => void;
    onInterrupted?: () => void;
    onVolumeChange?: (volume: number) => void;
  }) {
    const model = "gemini-2.5-flash-native-audio-preview-09-2025";
    
    this.session = await this.ai.live.connect({
      model,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
        },
        tools: [{ googleSearch: {} }],
        systemInstruction: `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), the sophisticated AI assistant created by Tony Stark.

CORE PERSONALITY:
- Helpful, efficient, and highly capable.
- Polite but possesses a dry, British wit.
- Calm under pressure; never sounds panicked.
- Loyal and protective of the user (whom you address as "Sir" or "Ma'am").

INTERACTION STYLE:
- Tone: Sophisticated, articulate, and slightly formal.
- Vocabulary: Use words like "Indeed," "Shall I," "Precisely," "I've taken the liberty of," "Awaiting your command."
- Greeting: "Good morning, Sir. All systems are operational. How may I assist you today?"
- Sign-off: "I'll be standing by, Sir." or "Very well, Sir. Powering down to standby mode."

KNOWLEDGE BASE & CAPABILITIES:
- Real-time Data: You have access to the web via Google Search to provide live updates on weather, news, and global events.
- General Knowledge: Deep expertise in science, engineering, history, and literature.
- User-Specific Info: You remember previous interactions in this session to maintain context.
- Synthesis: When asked for information, don't just list facts. Synthesize them into actionable insights (e.g., "The weather in London is rainy, Sir. I've adjusted your itinerary to prioritize indoor activities.").

Stay in character at all times. If the user asks who you are, remind them you are a system designed to assist them.`,
      },
      callbacks: {
        onopen: () => {
          callbacks.onStatusChange?.("Online");
          this.startMic(callbacks.onVolumeChange);
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.modelTurn?.parts) {
            for (const part of message.serverContent.modelTurn.parts) {
              if (part.inlineData?.data) {
                const base64Audio = part.inlineData.data;
                const audioData = this.base64ToUint8Array(base64Audio);
                const pcmData = new Int16Array(audioData.buffer);
                this.queueAudio(pcmData);
              }
              if (part.text) {
                callbacks.onMessage?.(part.text);
              }
            }
          }
          if (message.serverContent?.interrupted) {
            this.stopPlayback();
            callbacks.onInterrupted?.();
          }
        },
        onclose: () => {
          callbacks.onStatusChange?.("Offline");
          this.stopMic();
        },
        onerror: (err) => {
          console.error("JARVIS Error:", err);
          callbacks.onStatusChange?.("Error");
        }
      }
    });
  }

  private base64ToUint8Array(base64: string) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private async startMic(onVolumeChange?: (volume: number) => void) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          sum += s * s;
        }
        
        const volume = Math.sqrt(sum / inputData.length);
        onVolumeChange?.(volume);

        if (this.session && !this.isMuted) {
          const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
          this.session.sendRealtimeInput({
            media: { data: base64Data, mimeType: "audio/pcm;rate=16000" }
          });
        }
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (err) {
      console.error("Mic error:", err);
    }
  }

  private stopMic() {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.audioContext?.close();
  }

  private queueAudio(pcmData: Int16Array) {
    this.audioQueue.push(pcmData);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private async playNext() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const pcmData = this.audioQueue.shift()!;
    
    if (!this.audioContext) {
        this.audioContext = new AudioContext({ sampleRate: 24000 });
    }

    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / 32768.0;
    }

    const buffer = this.audioContext.createBuffer(1, floatData.length, 24000);
    buffer.getChannelData(0).set(floatData);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    const startTime = Math.max(this.audioContext.currentTime, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + buffer.duration;

    source.onended = () => {
      this.playNext();
    };
  }

  private stopPlayback() {
    this.audioQueue = [];
    this.isPlaying = false;
    this.nextStartTime = 0;
  }

  disconnect() {
    this.session?.close();
    this.stopMic();
    this.stopPlayback();
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  async sendText(text: string) {
    if (this.session) {
      this.session.sendRealtimeInput({
        text: text
      });
    }
  }
}
