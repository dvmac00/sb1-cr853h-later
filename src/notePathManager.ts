import { TFile, Vault } from 'obsidian';

interface NotePathRule {
  criteria: string;
  targetPath: string;
}

export class NotePathManager {
  private vault: Vault;
  private rules: NotePathRule[];

  constructor(vault: Vault, rules: NotePathRule[]) {
    this.vault = vault;
    this.rules = rules;
  }

  async getSuggestedPath(file: TFile): Promise<string | null> {
    const content = await this.vault.read(file);
    
    for (const rule of this.rules) {
      if (this.matchesCriteria(content, rule.criteria)) {
        return rule.targetPath;
      }
    }

    return null;
  }

  async checkAndMoveNote(file: TFile) {
    const suggestedPath = await this.getSuggestedPath(file);
    if (suggestedPath && file.path !== suggestedPath) {
      await this.moveNote(file, suggestedPath);
    }
  }

  async moveNote(file: TFile, newPath: string) {
    try {
      await this.vault.rename(file, newPath);
    } catch (error) {
      console.error('Failed to move note:', error);
      throw new Error('Failed to move note');
    }
  }

  private matchesCriteria(content: string, criteria: string): boolean {
    // For now, we'll just check if the content contains the criteria (e.g., a tag)
    // This can be expanded to support more complex criteria in the future
    return content.includes(criteria);
  }
}