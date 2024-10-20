import { ModelManager } from './modelManager';

export class TextCleaner {
  private modelManager: ModelManager;

  constructor(modelManager: ModelManager) {
    this.modelManager = modelManager;
  }

  async cleanText(text: string): Promise<string> {
    const prompt = `Please clean and improve the following text. Fix any grammatical errors, improve clarity and conciseness, and ensure proper formatting. Return only the cleaned text without any additional comments:

${text}`;

    try {
      const cleanedText = await this.modelManager.generateText(prompt);
      return cleanedText;
    } catch (error) {
      console.error('Error cleaning text:', error);
      throw new Error('Failed to clean text');
    }
  }
}