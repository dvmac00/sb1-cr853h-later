import { ModelManager } from './modelManager';

export class NLPManager {
  private modelManager: ModelManager;

  constructor(modelManager: ModelManager) {
    this.modelManager = modelManager;
  }

  async performTask(task: string, text: string): Promise<string> {
    const prompt = `Perform the following NLP task: ${task}\n\nText: ${text}\n\nResult:`;
    return this.modelManager.generateText(prompt);
  }
}