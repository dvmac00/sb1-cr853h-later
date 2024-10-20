import axios from 'axios';

export enum ModelProvider {
  Ollama = 'ollama',
  OpenAI = 'openai',
}

export class ModelManager {
  private provider: ModelProvider;
  private model: string;
  private endpoint: string;

  constructor(provider: ModelProvider, model: string, endpoint: string) {
    this.provider = provider;
    this.model = model;
    this.endpoint = endpoint;
  }

  setProvider(provider: ModelProvider) {
    this.provider = provider;
  }

  setModel(model: string) {
    this.model = model;
  }

  setEndpoint(endpoint: string) {
    this.endpoint = endpoint;
  }

  getAvailableModels(): string[] {
    switch (this.provider) {
      case ModelProvider.Ollama:
        return ['llama2', 'gpt4all', 'bloom'];
      case ModelProvider.OpenAI:
        return ['gpt-3.5-turbo', 'gpt-4'];
      default:
        return [];
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    switch (this.provider) {
      case ModelProvider.Ollama:
        return this.generateOllamaEmbedding(text);
      case ModelProvider.OpenAI:
        return this.generateOpenAIEmbedding(text);
      default:
        throw new Error('Unsupported model provider');
    }
  }

  async generateText(prompt: string): Promise<string> {
    switch (this.provider) {
      case ModelProvider.Ollama:
        return this.generateOllamaText(prompt);
      case ModelProvider.OpenAI:
        return this.generateOpenAIText(prompt);
      default:
        throw new Error('Unsupported model provider');
    }
  }

  private async generateOllamaEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post(`${this.endpoint}/api/embeddings`, {
        model: this.model,
        prompt: text,
      });
      return response.data.embedding;
    } catch (error) {
      console.error('Failed to generate Ollama embedding:', error);
      throw error;
    }
  }

  private async generateOpenAIEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post('https://api.openai.com/v1/embeddings', {
        model: 'text-embedding-ada-002',
        input: text,
      }, {
        headers: {
          'Authorization': `Bearer ${this.endpoint}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data.data[0].embedding;
    } catch (error) {
      console.error('Failed to generate OpenAI embedding:', error);
      throw error;
    }
  }

  private async generateOllamaText(prompt: string): Promise<string> {
    try {
      const response = await axios.post(`${this.endpoint}/api/generate`, {
        model: this.model,
        prompt: prompt,
      });
      return response.data.response.trim();
    } catch (error) {
      console.error('Failed to generate Ollama text:', error);
      throw error;
    }
  }

  private async generateOpenAIText(prompt: string): Promise<string> {
    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
      }, {
        headers: {
          'Authorization': `Bearer ${this.endpoint}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Failed to generate OpenAI text:', error);
      throw error;
    }
  }
}