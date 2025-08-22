/**
 * CommandEngine - Core system for loading and executing markdown-based commands
 * Handles command discovery, template processing, and execution coordination
 */

import { TFile, Vault, App, Notice } from 'obsidian';
import { Logger } from '../../../utils/logger';
import { StreamingManager } from '../../../ui/streaming-manager';
import { AIProviderManager } from '../../../ai/provider-manager';
import { ContextBuilder } from '../../../core/context-builder';
import { DocumentEngine } from '../../../core/document-engine';
import type { 
    MarkdownCommand, 
    CommandExecutionContext, 
    SmartContext,
    ExecutionOptions,
    TemplateVariable
} from '../types';
import type NovaPlugin from '../../../../main';

export class CommandEngine {
    private plugin: NovaPlugin;
    private app: App;
    private vault: Vault;
    private streamingManager: StreamingManager;
    private providerManager: AIProviderManager;
    private contextBuilder: ContextBuilder;
    private documentEngine: DocumentEngine;
    private logger = Logger.scope('CommandEngine');
    
    // Command discovery cache
    private commandsFolder = 'Commands';
    private loadedCommands = new Map<string, MarkdownCommand>();
    private lastScanTime = 0;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    constructor(plugin: NovaPlugin) {
        this.plugin = plugin;
        this.app = plugin.app;
        this.vault = plugin.app.vault;
        this.streamingManager = new StreamingManager(plugin);
        this.providerManager = plugin.aiProviderManager;
        this.contextBuilder = plugin.contextBuilder;
        this.documentEngine = plugin.documentEngine;
    }

    /**
     * Discover and load all commands from the Commands folder
     */
    async discoverCommands(): Promise<MarkdownCommand[]> {
        const now = Date.now();
        if (now - this.lastScanTime < this.CACHE_DURATION && this.loadedCommands.size > 0) {
            return Array.from(this.loadedCommands.values());
        }

        this.logger.info('Scanning for commands in Commands folder...');
        
        const commandsFolder = this.vault.getAbstractFileByPath(this.commandsFolder);
        if (!commandsFolder) {
            this.logger.warn('Commands folder not found, creating default commands');
            await this.createDefaultCommands();
            return this.discoverCommands(); // Retry after creating defaults
        }

        const commands: MarkdownCommand[] = [];
        const files = this.vault.getMarkdownFiles().filter(file => 
            file.path.startsWith(this.commandsFolder + '/')
        );

        for (const file of files) {
            try {
                const command = await this.loadCommandFromFile(file);
                if (command) {
                    commands.push(command);
                    this.loadedCommands.set(command.id, command);
                }
            } catch (error) {
                this.logger.error(`Failed to load command from ${file.path}:`, error);
            }
        }

        this.lastScanTime = now;
        this.logger.info(`Loaded ${commands.length} commands`);
        return commands;
    }

    /**
     * Load a single command from a markdown file
     */
    private async loadCommandFromFile(file: TFile): Promise<MarkdownCommand | null> {
        const content = await this.vault.read(file);
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        
        if (!frontmatter || !frontmatter.nova_command) {
            this.logger.debug(`Skipping ${file.name} - not a Nova command`);
            return null;
        }

        // Parse frontmatter for command metadata
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

        this.validateCommand(command);
        return command;
    }

    /**
     * Extract the template content from the markdown file
     * Everything after the frontmatter is considered the template
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

        return variablesData.map(varData => ({
            name: varData.name,
            description: varData.description || '',
            required: varData.required !== false,
            defaultValue: varData.default,
            resolver: varData.resolver || 'user_input'
        }));
    }

    /**
     * Validate that a command has required fields
     */
    private validateCommand(command: MarkdownCommand): void {
        if (!command.id || !command.name || !command.template) {
            throw new Error(`Invalid command: missing required fields (id, name, template)`);
        }
    }

    /**
     * Validate command and context before execution
     */
    private validateCommandExecution(command: MarkdownCommand, context: SmartContext): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Basic command validation
        if (!command.id || !command.name || !command.template) {
            errors.push('Command missing required fields (id, name, template)');
        }

        // Check if required variables can be resolved
        const requiredVars = command.variables.filter(v => v.required);
        for (const variable of requiredVars) {
            if (variable.resolver === 'selection' && !context.selection) {
                errors.push(`Command requires text selection but none found`);
            }
        }

        // Template validation
        if (command.template && !command.template.trim()) {
            errors.push('Command template is empty');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Execute a command with the given context
     */
    async executeCommand(
        command: MarkdownCommand, 
        context: SmartContext,
        options: ExecutionOptions = {
            outputMode: 'replace',
            showProgress: true
        }
    ): Promise<void> {
        this.logger.info(`Executing command: ${command.name}`);

        try {
            // Validate command before execution
            const validation = this.validateCommandExecution(command, context);
            if (!validation.isValid) {
                const errorMessage = `Command validation failed: ${validation.errors.join(', ')}`;
                this.logger.error(errorMessage);
                new Notice(errorMessage);
                throw new Error(errorMessage);
            }

            // Resolve template variables
            const resolvedVariables = await this.resolveVariables(command.variables, context);
            
            // Create execution context
            const executionContext: CommandExecutionContext = {
                command,
                variables: resolvedVariables,
                context,
                options
            };

            // Process the template
            const processedPrompt = this.processTemplate(command.template, resolvedVariables);
            
            // Execute via streaming manager
            await this.executeWithStreaming(processedPrompt, executionContext);

        } catch (error) {
            this.logger.error(`Command execution failed for ${command.name}:`, error);
            throw error;
        }
    }

    /**
     * Resolve all template variables for the command
     */
    private async resolveVariables(
        variables: TemplateVariable[], 
        context: SmartContext
    ): Promise<Record<string, string>> {
        const resolved: Record<string, string> = {};

        for (const variable of variables) {
            const value = await this.resolveVariable(variable, context);
            resolved[variable.name] = value;
        }

        return resolved;
    }

    /**
     * Resolve a single template variable
     */
    private async resolveVariable(
        variable: TemplateVariable, 
        context: SmartContext
    ): Promise<string> {
        switch (variable.resolver) {
            case 'selection':
                return context.selection || variable.defaultValue || '';
                
            case 'document':
                return context.document || variable.defaultValue || '';
                
            case 'cursor':
                return context.cursorContext || variable.defaultValue || '';
                
            case 'computed':
                return this.computeVariable(variable.name, context);
                
            case 'user_input':
            default:
                // For now, return default or empty - later we'll add user input modals
                return variable.defaultValue || '';
        }
    }

    /**
     * Compute special variables like metrics, audience_level, etc.
     */
    private computeVariable(variableName: string, context: SmartContext): string {
        switch (variableName) {
            case 'title':
                return context.title;
                
            case 'document_type':
                return context.documentType;
                
            case 'metrics':
                return `Word count: ${context.metrics.wordCount}, Reading level: ${context.metrics.readingLevel}`;
                
            case 'audience_level':
                return context.audienceLevel;
                
            default:
                return '';
        }
    }

    /**
     * Process template by replacing variables
     */
    private processTemplate(template: string, variables: Record<string, string>): string {
        let processed = template;
        
        for (const [name, value] of Object.entries(variables)) {
            const placeholder = `{${name}}`;
            processed = processed.replace(new RegExp(placeholder, 'g'), value);
        }

        return processed;
    }

    /**
     * Execute the processed command via AI provider with streaming
     */
    private async executeWithStreaming(
        prompt: string, 
        context: CommandExecutionContext
    ): Promise<void> {
        try {
            // Get document context from document engine
            const documentContext = await this.documentEngine.getDocumentContext();
            if (!documentContext) {
                throw new Error('No active document found');
            }

            // Get conversation context for continuity
            const conversationContext = this.documentEngine.getConversationContext();
            
            // Build proper AI prompt using existing context builder
            const editCommand = {
                action: 'edit' as const,
                target: 'selection' as const,
                instruction: prompt
            };
            
            const aiPrompt = this.contextBuilder.buildPrompt(
                editCommand,
                documentContext,
                conversationContext ? { includeHistory: true } : {},
                conversationContext
            );

            // Validate the prompt
            const validation = this.contextBuilder.validatePrompt(aiPrompt);
            if (!validation.valid) {
                throw new Error(`Prompt validation failed: ${validation.issues.join(', ')}`);
            }

            this.logger.info(`Executing command ${context.command.name} with AI provider`);

            // Get active editor for streaming
            const activeEditor = this.documentEngine.getActiveEditor();
            if (!activeEditor) {
                throw new Error('No active editor available for streaming');
            }

            // Set up streaming with the streaming manager
            const cursorPos = activeEditor.getCursor();
            const streaming = this.streamingManager.startStreaming(
                activeEditor,
                cursorPos,
                documentContext.selectedText ? activeEditor.getCursor('to') : null,
                {
                    animationMode: 'inline',
                    scrollBehavior: 'smooth'
                }
            );

            // Execute with streaming using existing provider manager
            let fullContent = '';
            const stream = this.providerManager.generateTextStream(
                aiPrompt.userPrompt,
                {
                    systemPrompt: aiPrompt.systemPrompt,
                    temperature: aiPrompt.config.temperature || 0.7,
                    maxTokens: aiPrompt.config.maxTokens || 2000
                }
            );

            // Handle streaming updates
            for await (const chunk of stream) {
                if (chunk.content) {
                    fullContent += chunk.content;
                    // Use streaming manager to handle the visual updates
                    streaming.updateStream(fullContent, false);
                }
            }

            // Complete the stream
            streaming.updateStream(fullContent, true);
            streaming.stopStream();

            this.logger.info(`Command ${context.command.name} completed successfully`);

        } catch (error) {
            this.logger.error(`Command execution failed for ${context.command.name}:`, error);
            new Notice(`Failed to execute ${context.command.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }


    /**
     * Create default command templates if Commands folder doesn't exist
     */
    private async createDefaultCommands(): Promise<void> {
        this.logger.info('Creating default command templates...');
        
        try {
            // Create Commands folder
            await this.vault.createFolder(this.commandsFolder).catch((error) => {
                // Folder might already exist, only log if it's a different error
                if (!error.message?.includes('already exists')) {
                    this.logger.warn('Failed to create Commands folder:', error);
                }
            });

            // Create expand-outline command as example
            const expandOutlineCommand = `---
nova_command: true
id: expand-outline
name: Expand Outline
description: Transform bullet points into flowing prose
category: writing
icon: ✨
keywords: [expand, outline, bullets, prose, develop]
variables:
  - name: text
    description: Text to expand
    resolver: selection
    required: true
  - name: style
    description: Expansion style
    resolver: user_input
    default: detailed
    required: false
example: "Select bullet points and use /expand-outline to convert to paragraphs"
---

Please expand the following outline into flowing prose:

{text}

Style: {style}

Transform each bullet point into well-developed sentences that flow naturally together. Maintain the logical structure while creating smooth transitions between ideas.`;

            const commandPath = `${this.commandsFolder}/expand-outline.md`;
            if (!this.vault.getAbstractFileByPath(commandPath)) {
                try {
                    await this.vault.create(commandPath, expandOutlineCommand);
                    this.logger.info('Created default expand-outline command');
                    new Notice('Nova Commands: Created default command templates in Commands folder');
                } catch (error) {
                    this.logger.error('Failed to create default command file:', error);
                    new Notice('Nova Commands: Failed to create default commands. Check file permissions.');
                }
            }
        } catch (error) {
            this.logger.error('Failed to create default commands:', error);
            new Notice('Nova Commands: Failed to initialize commands folder');
        }
    }

    /**
     * Clear the command cache to force reload
     */
    clearCache(): void {
        this.loadedCommands.clear();
        this.lastScanTime = 0;
        this.logger.info('Command cache cleared');
    }

    /**
     * Get a command by ID
     */
    async getCommand(id: string): Promise<MarkdownCommand | null> {
        const commands = await this.discoverCommands();
        return commands.find(cmd => cmd.id === id) || null;
    }

    /**
     * Search commands by query
     */
    async searchCommands(query: string): Promise<MarkdownCommand[]> {
        const commands = await this.discoverCommands();
        const lowerQuery = query.toLowerCase();
        
        return commands.filter(cmd => 
            cmd.name.toLowerCase().includes(lowerQuery) ||
            cmd.description.toLowerCase().includes(lowerQuery) ||
            cmd.keywords.some(keyword => keyword.toLowerCase().includes(lowerQuery))
        );
    }

    /**
     * Cleanup method for plugin unload
     */
    cleanup(): void {
        this.loadedCommands.clear();
        this.lastScanTime = 0;
        this.logger.info('CommandEngine cleaned up');
    }
}