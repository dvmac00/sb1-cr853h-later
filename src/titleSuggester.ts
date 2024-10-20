import { App, TFile } from 'obsidian';
import { ModelManager } from './modelManager';
import { VaultQuerier } from './vaultQuerier';

export class TitleSuggester {
  private app: App;
  private modelManager: ModelManager;
  private vaultQuerier: VaultQuerier;

  constructor(app: App, modelManager: ModelManager, vaultQuerier: VaultQuerier) {
    this.app = app;
    this.modelManager = modelManager;
    this.vaultQuerier = vaultQuerier;
  }

  async suggestTitle(file: TFile): Promise<string> {
    const content = await this.app.vault.read(file);
    const similarNotes = await this.findSimilarNotes(file);
    
    const prompt = `Suggest a title for the following note content. Consider these similar note titles for context: ${similarNotes.join(', ')}. Return only the suggested title as plain text:\n\n${content}`;
    return this.modelManager.generateText(prompt);
  }

  private async findSimilarNotes(file: TFile): Promise<string[]> {
    const content = await this.app.vault.read(file);
    const similarNotes = await this.vaultQuerier.queryVault(content, 5);
    return similarNotes.map(result => result.file.basename);
  }
}