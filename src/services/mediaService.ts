import { GoogleGenAI, VideoGenerationReferenceType, VideoGenerationReferenceImage } from "@google/genai";

export class JarvisMediaService {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async editImage(imageBuffer: ArrayBuffer, prompt: string, mimeType: string) {
    const base64Data = btoa(
      new Uint8Array(imageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");
  }

  async generateVideo(prompt: string, imageBuffer?: ArrayBuffer, mimeType?: string, aspectRatio: '16:9' | '9:16' = '16:9') {
    const config: any = {
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio
      }
    };

    if (imageBuffer && mimeType) {
      const base64Data = btoa(
        new Uint8Array(imageBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      config.image = {
        imageBytes: base64Data,
        mimeType: mimeType
      };
    }

    let operation = await this.ai.models.generateVideos(config);

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await this.ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed");

    // Note: The caller needs to handle the fetch with API key
    return downloadLink;
  }
}
