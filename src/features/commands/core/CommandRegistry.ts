/**
 * CommandRegistry - Manages command discovery, caching, and lazy loading
 * Optimizes memory usage by loading commands only when needed
 */

import { TFile } from 'obsidian';
import { Logger } from '../../../utils/logger';
import { CommandEngine } from './CommandEngine';
import type { MarkdownCommand, CommandRegistry as ICommandRegistry, TemplateVariable } from '../types';
import type NovaPlugin from '../../../../main';

export class CommandRegistry implements ICommandRegistry {
    private plugin: NovaPlugin;
    private commandEngine: CommandEngine;
    private logger = Logger.scope('CommandRegistry');
    
    // Lazy loading cache - commands loaded on-demand
    private commandCache = new Map<string, MarkdownCommand>();
    private commandIndex = new Map<string, string>(); // id -> filePath mapping
    private categoryIndex = new Map<string, string[]>(); // category -> command ids
    private keywordIndex = new Map<string, string[]>(); // keyword -> command ids
    
    // Cache metadata
    private isIndexBuilt = false;
    private lastIndexTime = 0;
    private readonly INDEX_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
    
    // Memory management
    private readonly MAX_CACHED_COMMANDS = 50;
    private commandAccessTimes = new Map<string, number>();

    constructor(plugin: NovaPlugin, commandEngine: CommandEngine) {
        this.plugin = plugin;
        this.commandEngine = commandEngine;
    }

    /**
     * Build the command index without loading full command content
     * This allows fast discovery while keeping memory usage low
     */
    buildIndex(): void {
        const now = Date.now();
        if (this.isIndexBuilt && (now - this.lastIndexTime) < this.INDEX_REFRESH_INTERVAL) {
            return;
        }

        this.logger.info('Building command index...');
        
        // Clear existing indexes
        this.commandIndex.clear();
        this.categoryIndex.clear();
        this.keywordIndex.clear();

        const commandsFolder = 'Commands';
        const files = this.plugin.app.vault.getMarkdownFiles().filter(file => 
            file.path.startsWith(commandsFolder + '/')
        );

        let indexedCount = 0;
        for (const file of files) {
            try {
                this.indexCommandFile(file);
                indexedCount++;
            } catch (error) {
                this.logger.error(`Failed to index command file ${file.path}:`, error);
            }
        }

        this.isIndexBuilt = true;
        this.lastIndexTime = now;
        this.logger.info(`Indexed ${indexedCount} commands`);
    }

    /**
     * Index a single command file by reading only its frontmatter
     */
    private indexCommandFile(file: TFile): void {
        const cache = this.plugin.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter;
        
        if (!frontmatter || !frontmatter.nova_command) {
            return; // Not a Nova command
        }

        const id = frontmatter.id || file.basename;
        const category = frontmatter.category || 'writing';
        const keywords = Array.isArray(frontmatter.keywords) ? frontmatter.keywords : [];

        // Update indexes
        this.commandIndex.set(id, file.path);
        
        // Category index
        if (!this.categoryIndex.has(category)) {
            this.categoryIndex.set(category, []);
        }
        this.categoryIndex.get(category)!.push(id);

        // Keyword index
        for (const keyword of keywords) {
            const normalizedKeyword = keyword.toLowerCase();
            if (!this.keywordIndex.has(normalizedKeyword)) {
                this.keywordIndex.set(normalizedKeyword, []);
            }
            this.keywordIndex.get(normalizedKeyword)!.push(id);
        }
    }

    /**
     * Load a command by ID with lazy loading and caching
     */
    async loadCommand(commandId: string): Promise<MarkdownCommand | null> {
        this.buildIndex();

        // Check cache first
        const cached = this.commandCache.get(commandId);
        if (cached) {
            this.commandAccessTimes.set(commandId, Date.now());
            return cached;
        }

        // Get file path from index
        const filePath = this.commandIndex.get(commandId);
        if (!filePath) {
            this.logger.warn(`Command not found: ${commandId}`);
            return null;
        }

        // Load from file
        const abstractFile = this.plugin.app.vault.getAbstractFileByPath(filePath);
        if (!abstractFile || !(abstractFile instanceof TFile)) {
            this.logger.error(`Command file not found: ${filePath}`);
            return null;
        }
        const file = abstractFile;

        try {
            const command = await this.loadCommandFromFile(file);
            if (command) {
                this.cacheCommand(command);
                return command;
            }
        } catch (error) {
            this.logger.error(`Failed to load command ${commandId}:`, error);
        }

        return null;
    }

    /**
     * Load command from file (similar to CommandEngine but with caching)
     */
    private async loadCommandFromFile(file: TFile): Promise<MarkdownCommand | null> {
        const content = await this.plugin.app.vault.read(file);
        const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
        
        if (!frontmatter || !frontmatter.nova_command) {
            return null;
        }

        const command: MarkdownCommand = {
            id: frontmatter.id || file.basename,
            name: frontmatter.name || file.basename,
            description: frontmatter.description || 'No description provided',
            template: this.extractTemplate(content),
            example: frontmatter.example,
            keywords: Array.isArray(frontmatter.keywords) ? frontmatter.keywords : [],
            category: frontmatter.category || 'writing',
            iconType: frontmatter.icon || '💡',
            variables: this.parseVariables(frontmatter.variables || []),
            filePath: file.path
        };

        return command;
    }

    /**
     * Extract template content from markdown
     */
    private extractTemplate(content: string): string {
        const frontmatterEnd = content.indexOf('---', 3);
        if (frontmatterEnd === -1) {
            return content;
        }
        return content.substring(frontmatterEnd + 3).trim();
    }

    /**
     * Parse template variables from frontmatter
     */
    private parseVariables(variablesData: unknown[]): TemplateVariable[] {
        if (!Array.isArray(variablesData)) {
            return [];
        }

        return variablesData.map((varData: unknown) => {
            const data = varData as Record<string, unknown>;
            return {
                name: String(data.name ?? ''),
                description: String(data.description ?? ''),
                required: data.required !== false,
                defaultValue: data.default !== undefined ? String(data.default) : undefined,
                resolver: (data.resolver as TemplateVariable['resolver']) || 'user_input'
            };
        });
    }

    /**
     * Cache a command with memory management
     */
    private cacheCommand(command: MarkdownCommand): void {
        // Remove least recently used commands if cache is full
        if (this.commandCache.size >= this.MAX_CACHED_COMMANDS) {
            this.evictLeastRecentlyUsed();
        }

        this.commandCache.set(command.id, command);
        this.commandAccessTimes.set(command.id, Date.now());
    }

    /**
     * Evict least recently used commands from cache
     */
    private evictLeastRecentlyUsed(): void {
        const entries = Array.from(this.commandAccessTimes.entries());
        entries.sort((a, b) => a[1] - b[1]); // Sort by access time (oldest first)
        
        const toEvict = entries.slice(0, 10); // Remove oldest 10 commands
        for (const [commandId] of toEvict) {
            this.commandCache.delete(commandId);
            this.commandAccessTimes.delete(commandId);
        }

        this.logger.debug(`Evicted ${toEvict.length} commands from cache`);
    }

    /**
     * Get all available commands (loads all into memory - use sparingly)
     */
    async getAllCommands(): Promise<MarkdownCommand[]> {
        this.buildIndex();
        
        const commands: MarkdownCommand[] = [];
        for (const commandId of this.commandIndex.keys()) {
            const command = await this.loadCommand(commandId);
            if (command) {
                commands.push(command);
            }
        }

        return commands;
    }

    /**
     * Get commands by category (lazy loaded)
     */
    async getCommandsByCategory(category: string): Promise<MarkdownCommand[]> {
        this.buildIndex();
        
        const commandIds = this.categoryIndex.get(category) || [];
        const commands: MarkdownCommand[] = [];
        
        for (const commandId of commandIds) {
            const command = await this.loadCommand(commandId);
            if (command) {
                commands.push(command);
            }
        }

        return commands;
    }

    /**
     * Search commands by query string
     */
    async searchCommands(query: string): Promise<MarkdownCommand[]> {
        this.buildIndex();
        
        const lowerQuery = query.toLowerCase();
        const matchingIds = new Set<string>();

        // Search by keywords
        for (const [keyword, commandIds] of this.keywordIndex.entries()) {
            if (keyword.includes(lowerQuery)) {
                commandIds.forEach(id => matchingIds.add(id));
            }
        }

        // Load matching commands and filter by name/description
        const commands: MarkdownCommand[] = [];
        for (const commandId of matchingIds) {
            const command = await this.loadCommand(commandId);
            if (command) {
                commands.push(command);
            }
        }

        // Also check command names and descriptions
        for (const commandId of this.commandIndex.keys()) {
            if (matchingIds.has(commandId)) continue; // Already included
            
            const command = await this.loadCommand(commandId);
            if (command && (
                command.name.toLowerCase().includes(lowerQuery) ||
                command.description.toLowerCase().includes(lowerQuery)
            )) {
                commands.push(command);
            }
        }

        return commands;
    }

    /**
     * Clear all caches
     */
    clearCache(): void {
        this.commandCache.clear();
        this.commandAccessTimes.clear();
        this.commandIndex.clear();
        this.categoryIndex.clear();
        this.keywordIndex.clear();
        this.isIndexBuilt = false;
        this.lastIndexTime = 0;
        
        this.logger.info('Registry cache cleared');
    }

    /**
     * Get cache statistics for debugging
     */
    getCacheStats(): {
        cachedCommands: number;
        indexedCommands: number;
        memoryUsageMB: number;
    } {
        // Rough memory calculation (very approximate)
        const commandSizeEstimate = 2; // KB per command
        const memoryUsageMB = (this.commandCache.size * commandSizeEstimate) / 1024;

        return {
            cachedCommands: this.commandCache.size,
            indexedCommands: this.commandIndex.size,
            memoryUsageMB: Math.round(memoryUsageMB * 100) / 100
        };
    }

    /**
     * Preload frequently used commands for better performance
     */
    async preloadFrequentCommands(commandIds: string[]): Promise<void> {
        this.logger.info(`Preloading ${commandIds.length} frequent commands...`);
        
        const loadPromises = commandIds.map(id => this.loadCommand(id));
        await Promise.allSettled(loadPromises);
        
        this.logger.info('Frequent commands preloaded');
    }

    /**
     * Get list of available command IDs without loading full commands
     */
    getCommandIds(): string[] {
        this.buildIndex();
        return Array.from(this.commandIndex.keys());
    }

    /**
     * Get available categories
     */
    getCategories(): string[] {
        this.buildIndex();
        return Array.from(this.categoryIndex.keys());
    }

    /**
     * Cleanup method for plugin unload
     */
    cleanup(): void {
        this.clearCache();
        this.logger.info('CommandRegistry cleaned up');
    }
}