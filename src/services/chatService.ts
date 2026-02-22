import { GoogleGenAI } from "@google/genai";

export class JarvisChatService {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async sendMessage(message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[] = [], userProfile?: { name: string, greeting: string }) {
    const systemInstruction = userProfile 
      ? `You are J.A.R.V.I.S., the tactical interface for ${userProfile.name}. You should address them as ${userProfile.greeting}. You provide deep analysis, strategic advice, and complex reasoning. You are polite, British, and highly intelligent.`
      : "You are J.A.R.V.I.S., the tactical interface for Tony Stark. You provide deep analysis, strategic advice, and complex reasoning. You are polite, British, and highly intelligent.";

    const chat = this.ai.chats.create({
      model: "gemini-3.1-pro-preview",
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }]
      },
      history: history
    });

    const response = await chat.sendMessage({ message });
    return response;
  }

  async fastResponse(prompt: string) {
    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
      config: {
        systemInstruction: "You are J.A.R.V.I.S. providing a rapid system update. Be extremely concise."
      }
    });
    return response.text;
  }
}
