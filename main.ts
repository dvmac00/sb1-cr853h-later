import { Plugin, PluginSettingTab, App, Setting, TFile, Notice, Modal, TextComponent, DropdownComponent } from 'obsidian';
import { EmbeddingManager } from './src/embeddings';
import { DatabaseManager } from './src/db';
import { Atomizer } from './src/atomizer';
import { TitleSuggester } from './src/titleSuggester';
import { VaultQuerier } from './src/vaultQuerier';
import { NLPManager } from './src/nlpManager';
import { ModelManager, ModelProvider } from './src/modelManager';
import { TextCleaner } from './src/textCleaner';
import { TagSuggester } from './src/tagSuggester';
import { NotePathManager } from './src/notePathManager';
import { AIChat } from './src/aiChat';
import './styles.css';

interface AIPluginSettings {
  ollamaEndpoint: string;
  cacheExpiration: number;
  selectedModel: string;
  selectedProvider: ModelProvider;
  notePathRules: NotePathRule[];
}

interface NotePathRule {
  criteria: string;
  targetPath: string;
}

const DEFAULT_SETTINGS: AIPluginSettings = {
  ollamaEndpoint: 'http://localhost:11434',
  cacheExpiration: 24 * 60 * 60 * 1000,
  selectedModel: 'llama2',
  selectedProvider: ModelProvider.Ollama,
  notePathRules: [],
};

export default class AIPlugin extends Plugin {
  settings: AIPluginSettings;
  embeddingManager: EmbeddingManager;
  databaseManager: DatabaseManager;
  atomizer: Atomizer;
  titleSuggester: TitleSuggester;
  vaultQuerier: VaultQuerier;
  nlpManager: NLPManager;
  modelManager: ModelManager;
  textCleaner: TextCleaner;
  tagSuggester: TagSuggester;
  notePathManager: NotePathManager;
  aiChat: AIChat;

  async onload() {
    await this.loadSettings();

    // Initialize components
    this.modelManager = new ModelManager(this.settings.selectedProvider, this.settings.selectedModel, this.settings.ollamaEndpoint);
    this.databaseManager = new DatabaseManager();
    await this.databaseManager.init();
    this.embeddingManager = new EmbeddingManager(this.app.vault, this.modelManager, this.databaseManager, this.settings.cacheExpiration);
    this.atomizer = new Atomizer(this.app.vault, this.modelManager);
    this.vaultQuerier = new VaultQuerier(this.app.vault, this.embeddingManager, this.databaseManager);
    this.titleSuggester = new TitleSuggester(this.app, this.modelManager, this.vaultQuerier);
    this.nlpManager = new NLPManager(this.modelManager);
    this.textCleaner = new TextCleaner(this.modelManager);
    this.tagSuggester = new TagSuggester(this.modelManager);
    this.notePathManager = new NotePathManager(this.app.vault, this.settings.notePathRules);
    this.aiChat = new AIChat(this.app, this.modelManager);

    // Add settings tab
    this.addSettingTab(new AIPluginSettingTab(this.app, this));

    // Add ribbon icon for AI Chat
    this.addRibbonIcon('message-square', 'AI Chat', () => {
      this.aiChat.openChatWindow();
    });

    // Add commands
    this.addCommand({
      id: 'suggest-and-move-note',
      name: 'Suggest and Move Note',
      callback: () => this.suggestAndMoveNote(),
    });

    this.addCommand({
      id: 'atomize-note',
      name: 'Atomize Current Note',
      callback: () => this.atomizeCurrentNote(),
    });

    this.addCommand({
      id: 'suggest-title',
      name: 'Suggest Title for Current Note',
      callback: () => this.suggestTitleForCurrentNote(),
    });

    this.addCommand({
      id: 'clean-text',
      name: 'Clean Text of Current Note',
      callback: () => this.cleanTextOfCurrentNote(),
    });

    this.addCommand({
      id: 'suggest-tags',
      name: 'Suggest Tags for Current Note',
      callback: () => this.suggestTagsForCurrentNote(),
    });

    this.addCommand({
      id: 'open-ai-chat',
      name: 'Open AI Chat',
      callback: () => this.aiChat.openChatWindow(),
    });

    // Register for events
    this.registerEvent(
      this.app.vault.on('modify', (file: TFile) => {
        this.updateEmbeddingsForFile(file);
        this.notePathManager.checkAndMoveNote(file);
      })
    );
  }

  async suggestAndMoveNote() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('No active file');
      return;
    }

    const suggestedPath = await this.notePathManager.getSuggestedPath(activeFile);
    if (suggestedPath) {
      const modal = new SuggestMoveNoteModal(this.app, activeFile, suggestedPath, async () => {
        await this.notePathManager.moveNote(activeFile, suggestedPath);
        new Notice(`Moved note to ${suggestedPath}`);
      });
      modal.open();
    } else {
      new Notice('No suggested path for this note');
    }
  }

  async atomizeCurrentNote() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('No active file');
      return;
    }

    try {
      const atomicNotes = await this.atomizer.atomizeNote(activeFile);
      for (const note of atomicNotes) {
        await this.app.vault.create(`${note.title}.md`, note.content);
      }
      new Notice(`Created ${atomicNotes.length} atomic notes`);
    } catch (error) {
      console.error('Error atomizing note:', error);
      new Notice('Failed to atomize note');
    }
  }

  async suggestTitleForCurrentNote() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('No active file');
      return;
    }

    try {
      const suggestedTitle = await this.titleSuggester.suggestTitle(activeFile);
      const modal = new SuggestTitleModal(this.app, activeFile, suggestedTitle, async (newTitle) => {
        await this.app.fileManager.renameFile(activeFile, `${newTitle}.md`);
        new Notice(`Renamed note to "${newTitle}"`);
      });
      modal.open();
    } catch (error) {
      console.error('Error suggesting title:', error);
      new Notice('Failed to suggest title');
    }
  }

  async cleanTextOfCurrentNote() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('No active file');
      return;
    }

    try {
      const content = await this.app.vault.read(activeFile);
      const cleanedText = await this.textCleaner.cleanText(content);
      await this.app.vault.modify(activeFile, cleanedText);
      new Notice('Text cleaned successfully');
    } catch (error) {
      console.error('Error cleaning text:', error);
      new Notice('Failed to clean text');
    }
  }

  async suggestTagsForCurrentNote() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('No active file');
      return;
    }

    try {
      const content = await this.app.vault.read(activeFile);
      const suggestedTags = await this.tagSuggester.suggestTags(activeFile, content);
      const modal = new SuggestTagsModal(this.app, activeFile, suggestedTags, async (selectedTags) => {
        await this.addTagsToNote(activeFile, selectedTags);
        new Notice(`Added ${selectedTags.length} tags to the note`);
      });
      modal.open();
    } catch (error) {
      console.error('Error suggesting tags:', error);
      new Notice('Failed to suggest tags');
    }
  }

  private async addTagsToNote(file: TFile, tags: string[]) {
    const content = await this.app.vault.read(file);
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    let newContent = content;

    if (frontmatter) {
      const existingTags = frontmatter.tags || [];
      const updatedTags = [...new Set([...existingTags, ...tags])];
      const updatedFrontmatter = { ...frontmatter, tags: updatedTags };
      newContent = content.replace(/^---\n[\s\S]*?\n---\n/, `---\n${JSON.stringify(updatedFrontmatter, null, 2)}\n---\n`);
    } else {
      const newFrontmatter = { tags };
      newContent = `---\n${JSON.stringify(newFrontmatter, null, 2)}\n---\n${content}`;
    }

    await this.app.vault.modify(file, newContent);
  }

  async updateEmbeddingsForFile(file: TFile) {
    try {
      await this.embeddingManager.generateEmbeddingsForFile(file);
    } catch (error) {
      console.error('Error updating embeddings:', error);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class AIPluginSettingTab extends PluginSettingTab {
  plugin: AIPlugin;

  constructor(app: App, plugin: AIPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('ai-plugin-settings');

    containerEl.createEl('h2', { text: 'AI Plugin Settings' });

    new Setting(containerEl)
      .setName('Ollama Endpoint')
      .setDesc('The URL of your Ollama server')
      .addText(text => text
        .setPlaceholder('http://localhost:11434')
        .setValue(this.plugin.settings.ollamaEndpoint)
        .onChange(async (value) => {
          this.plugin.settings.ollamaEndpoint = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Cache Expiration')
      .setDesc('Time in milliseconds before embeddings are regenerated')
      .addText(text => text
        .setPlaceholder('86400000')
        .setValue(String(this.plugin.settings.cacheExpiration))
        .onChange(async (value) => {
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            this.plugin.settings.cacheExpiration = numValue;
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName('Model Provider')
      .setDesc('Select the AI model provider')
      .addDropdown(dropdown => dropdown
        .addOption(ModelProvider.Ollama, 'Ollama')
        .addOption(ModelProvider.OpenAI, 'OpenAI')
        .setValue(this.plugin.settings.selectedProvider)
        .onChange(async (value: ModelProvider) => {
          this.plugin.settings.selectedProvider = value;
          await this.plugin.saveSettings();
          this.display(); // Refresh to update model options
        }));

    new Setting(containerEl)
      .setName('Selected Model')
      .setDesc('Choose the AI model to use')
      .addDropdown(dropdown => {
        const models = this.plugin.modelManager.getAvailableModels();
        models.forEach(model => dropdown.addOption(model, model));
        dropdown.setValue(this.plugin.settings.selectedModel)
          .onChange(async (value) => {
            this.plugin.settings.selectedModel = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Note Path Rules')
      .setDesc('Configure rules for automatically moving notes based on criteria')
      .addButton(button => button
        .setButtonText('Add Rule')
        .onClick(() => {
          this.plugin.settings.notePathRules.push({ criteria: '', targetPath: '' });
          this.plugin.saveSettings();
          this.display();
        }));

    this.plugin.settings.notePathRules.forEach((rule, index) => {
      const ruleContainer = containerEl.createDiv();
      new Setting(ruleContainer)
        .setName(`Rule ${index + 1}`)
        .addText(text => text
          .setPlaceholder('Criteria (e.g., #project)')
          .setValue(rule.criteria)
          .onChange(async (value) => {
            this.plugin.settings.notePathRules[index].criteria = value;
            await this.plugin.saveSettings();
          }))
        .addText(text => text
          .setPlaceholder('Target Path')
          .setValue(rule.targetPath)
          .onChange(async (value) => {
            this.plugin.settings.notePathRules[index].targetPath = value;
            await this.plugin.saveSettings();
          }))
        .addButton(button => button
          .setButtonText('Remove')
          .onClick(async () => {
            this.plugin.settings.notePathRules.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
          }));
    });
  }
}

class SuggestMoveNoteModal extends Modal {
  constructor(app: App, private file: TFile, private suggestedPath: string, private onMove: () => void) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ai-plugin-modal');
    contentEl.setText(`Move "${this.file.name}" to "${this.suggestedPath}"?`);
    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Move')
        .addClass('ai-plugin-button')
        .onClick(() => {
          this.onMove();
          this.close();
        }))
      .addButton(button => button
        .setButtonText('Cancel')
        .addClass('ai-plugin-button')
        .onClick(() => this.close()));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class SuggestTitleModal extends Modal {
  constructor(app: App, private file: TFile, private suggestedTitle: string, private onRename: (newTitle: string) => void) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ai-plugin-modal');
    contentEl.createEl('h2', { text: 'Suggest Title' });
    const titleInput = new TextComponent(contentEl)
      .setValue(this.suggestedTitle)
      .setPlaceholder('Enter title');

    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Rename')
        .addClass('ai-plugin-button')
        .onClick(() => {
          this.onRename(titleInput.getValue());
          this.close();
        }))
      .addButton(button => button
        .setButtonText('Cancel')
        .addClass('ai-plugin-button')
        .onClick(() => this.close()));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class SuggestTagsModal extends Modal {
  private selectedTags: string[] = [];

  constructor(app: App, private file: TFile, private suggestedTags: string[], private onApply: (selectedTags: string[]) => void) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('ai-plugin-modal');
    contentEl.createEl('h2', { text: 'Suggest Tags' });

    this.suggestedTags.forEach(tag => {
      new Setting(contentEl)
        .setName(tag)
        .addToggle(toggle => toggle
          .onChange(value => {
            if (value) {
              this.selectedTags.push(tag);
            } else {
              this.selectedTags = this.selectedTags.filter(t => t !== tag);
            }
          }));
    });

    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Apply Tags')
        .addClass('ai-plugin-button')
        .onClick(() => {
          this.onApply(this.selectedTags);
          this.close();
        }))
      .addButton(button => button
        .setButtonText('Cancel')
        .addClass('ai-plugin-button')
        .onClick(() => this.close()));
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}