import { TFile, Vault } from 'obsidian';
import { ModelManager } from './modelManager';

interface AtomicNote {
  title: string;
  content: string;
}

export class Atomizer {
  private vault: Vault;
  private modelManager: ModelManager;

  constructor(vault: Vault, modelManager: ModelManager) {
    this.vault = vault;
    this.modelManager = modelManager;
  }

  async atomizeNote(file: TFile): Promise<AtomicNote[]> {
    const content = await this.vault.read(file);
    const concepts = await this.identifyKeyConcepts(content);
    const atomicNotes: AtomicNote[] = [];

    for (const concept of concepts) {
      const atomicNote = await this.generateAtomicNote(concept, content);
      atomicNotes.push(atomicNote);
    }

    return atomicNotes;
  }

  private async identifyKeyConcepts(content: string): Promise<string[]> {
    const prompt = `Identify key concepts in the following text. Return the concepts as a JSON array of strings:\n\n${content}`;
    const response = await this.modelManager.generateText(prompt);
    return JSON.parse(response);
  }

  private async generateAtomicNote(concept: string, sourceContent: string): Promise<AtomicNote> {
    const prompt = `Generate an atomic note about "${concept}" based on the following source content. Return the result as a JSON object with "title" and "content" fields. The content should include a reference back to the original note:\n\n${sourceContent}`;
    const response = await this.modelManager.generateText(prompt);
    return JSON.parse(response);
  }
}