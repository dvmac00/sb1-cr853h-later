import { TFile, Vault } from 'obsidian';
import { DatabaseManager } from './db';
import { ModelManager } from './modelManager';

export interface Embedding {
  id: string;
  vector: number[];
  file: string;
  chunk: string;
  timestamp: number;
}

export class EmbeddingManager {
  private vault: Vault;
  private modelManager: ModelManager;
  private databaseManager: DatabaseManager;
  private cacheExpiration: number;

  constructor(vault: Vault, modelManager: ModelManager, databaseManager: DatabaseManager, cacheExpiration: number) {
    this.vault = vault;
    this.modelManager = modelManager;
    this.databaseManager = databaseManager;
    this.cacheExpiration = cacheExpiration;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.modelManager.generateEmbedding(text);
  }

  async generateEmbeddingsForFile(file: TFile): Promise<Embedding[]> {
    const content = await this.vault.read(file);
    const chunks = this.chunkContent(content);
    const embeddings: Embedding[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const vector = await this.generateEmbedding(chunks[i]);
      embeddings.push({
        id: `${file.path}-${i}`,
        vector,
        file: file.path,
        chunk: chunks[i],
        timestamp: Date.now(),
      });
    }

    await this.databaseManager.storeEmbeddings(embeddings);
    return embeddings;
  }

  async getEmbeddingsForFile(file: TFile): Promise<Embedding[]> {
    const storedEmbeddings = await this.databaseManager.getEmbeddingsForFile(file.path);
    if (storedEmbeddings.length > 0 && this.isEmbeddingValid(storedEmbeddings[0])) {
      return storedEmbeddings;
    }
    return this.generateEmbeddingsForFile(file);
  }

  private chunkContent(content: string): string[] {
    // Implement chunking logic here
    // For simplicity, we'll use a basic paragraph-based chunking
    return content.split('\n\n').filter(chunk => chunk.trim() !== '');
  }

  private isEmbeddingValid(embedding: Embedding): boolean {
    return Date.now() - embedding.timestamp < this.cacheExpiration;
  }
}