import { TFile, Vault } from 'obsidian';
import { EmbeddingManager, Embedding } from './embeddings';
import { DatabaseManager } from './db';

export class VaultQuerier {
  private vault: Vault;
  private embeddingManager: EmbeddingManager;
  private databaseManager: DatabaseManager;

  constructor(vault: Vault, embeddingManager: EmbeddingManager, databaseManager: DatabaseManager) {
    this.vault = vault;
    this.embeddingManager = embeddingManager;
    this.databaseManager = databaseManager;
  }

  async queryVault(query: string, topK: number = 5): Promise<Array<{ file: TFile; similarity: number }>> {
    const queryEmbedding = await this.embeddingManager.generateEmbedding(query);
    const allEmbeddings = await this.databaseManager.getAllEmbeddings();

    const results = allEmbeddings.map(embedding => ({
      file: this.vault.getAbstractFileByPath(embedding.file) as TFile,
      similarity: this.cosineSimilarity(queryEmbedding, embedding.vector)
    }));

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (mag1 * mag2);
  }
}