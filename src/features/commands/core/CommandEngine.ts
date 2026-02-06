/**
 * @file CommandEngine - Core system for executing commands and the /fill command
 * Handles template processing and AI execution coordination
 */

import { Notice, type Editor } from 'obsidian';
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

/**
 * Marker detected in document for /fill command
 */
export interface MarkerInsight {
    line: number;
    endLine: number;
    instruction: string;
    position: number;
    length: number;
}

/**
 * Insert a `<!-- nova: Replace this text -->` placeholder at the cursor
 * and select "Replace this text" so the user can immediately type their instruction.
 */
export function insertSmartFillPlaceholder(editor: Editor): void {
    const cursor = editor.getCursor();
    const placeholder = '<!-- nova: Replace this text -->';
    editor.replaceRange(placeholder, cursor);
    // Select "Replace this text" so user can type over it
    const startCh = cursor.ch + '<!-- nova: '.length;
    const endCh = startCh + 'Replace this text'.length;
    editor.setSelection(
        { line: cursor.line, ch: startCh },
        { line: cursor.line, ch: endCh }
    );
}

export class CommandEngine {
    private plugin: NovaPlugin;
    private streamingManager: StreamingManager;
    private providerManager: AIProviderManager;
    private contextBuilder: ContextBuilder;
    private documentEngine: DocumentEngine;
    private logger = Logger.scope('CommandEngine');
    private abortController: AbortController | null = null;

    constructor(plugin: NovaPlugin) {
        this.plugin = plugin;
        this.streamingManager = new StreamingManager(plugin);
        this.providerManager = plugin.aiProviderManager;
        this.contextBuilder = plugin.contextBuilder;
        this.documentEngine = plugin.documentEngine;
    }

    /**
     * Detect all `<!-- nova: instruction -->` markers in document content
     */
    detectMarkers(content: string): MarkerInsight[] {
        const markerPattern = /<!--\s*nova:\s*([\s\S]+?)\s*-->/gi;
        const markers: MarkerInsight[] = [];

        let match;
        while ((match = markerPattern.exec(content)) !== null) {
            const startLine = this.getLineNumber(content, match.index);
            const endLine = this.getLineNumber(content, match.index + match[0].length);

            markers.push({
                line: startLine,
                endLine: endLine,
                instruction: match[1].trim(),
                position: match.index,
                length: match[0].length
            });
        }

        return markers;
    }

    /**
     * Get line number for a character position in content
     */
    private getLineNumber(content: string, position: number): number {
        const beforePosition = content.substring(0, position);
        return beforePosition.split('\n').length - 1;
    }

    /**
     * Execute fill for a single marker at a specific line
     * Uses full document context for better coherence
     */
    async executeFillSingle(lineNumber: number, instruction?: string): Promise<void> {

        const documentContext = this.documentEngine.getDocumentContext();
        if (!documentContext) {
            new Notice('No active document found');
            return;
        }

        const markers = this.detectMarkers(documentContext.content);

        // Search by instruction first (more reliable), fall back to line number
        const targetMarker = instruction
            ? markers.find(m => m.instruction === instruction)
            : markers.find(m => m.line === lineNumber);

        if (!targetMarker) {
            new Notice('No placeholder found at this line');
            return;
        }

        this.logger.info(`Filling single marker at line ${lineNumber + 1}`);

        const activeEditor = this.documentEngine.getActiveEditor();
        if (!activeEditor) {
            new Notice('No active editor available');
            return;
        }

        // Create abort controller for this operation
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        try {
            // Show thinking notice for duration of fill operation
            this.streamingManager.showThinkingNotice('edit', 'notice');

            // Build prompt with full document context
            const prompt = this.buildSingleFillPrompt(documentContext.content, targetMarker);

            // Calculate positions for marker replacement
            const startPos = activeEditor.offsetToPos(targetMarker.position);
            const endPos = activeEditor.offsetToPos(targetMarker.position + targetMarker.length);

            // Start streaming to replace the marker
            const streaming = this.streamingManager.startStreaming(
                activeEditor,
                startPos,
                endPos,
                {
                    animationMode: 'inline',
                    scrollBehavior: 'smooth'
                }
            );

            // Get AI response with streaming
            let fullContent = '';
            const stream = this.providerManager.generateTextStream(
                prompt,
                {
                    systemPrompt: 'You are a helpful writing assistant. Generate high-quality content that matches the style and tone of the surrounding document.',
                    temperature: 0.7,
                    maxTokens: 2000,
                    signal: signal
                }
            );

            // Handle streaming updates
            for await (const chunk of stream) {
                if (signal.aborted) {
                    streaming.stopStream();
                    break;
                }
                if (chunk.content) {
                    fullContent += chunk.content;
                    streaming.updateStream(fullContent, false);
                }
            }

            // Complete the stream (finalizes cursor position)
            if (!signal.aborted) {
                streaming.updateStream(fullContent, true);
                new Notice('Filled placeholder');
            } else {
                // Show canceled message in chat (matching context menu format)
                // Message must be >30 chars for bubble format, don't include ❌ (auto-added)
                try {
                    const sidebarView = this.plugin.getCurrentSidebarView();
                    if (sidebarView?.chatRenderer) {
                        sidebarView.chatRenderer.addErrorMessage('Operation canceled: fill placeholder', true);
                    }
                } catch (error) {
                    this.logger.warn('Failed to add cancel message to chat:', error);
                }
                new Notice('Fill canceled');
            }

            // Hide thinking notice when complete
            this.streamingManager.stopAnimation();

        } catch (error) {
            this.streamingManager.stopAnimation();
            this.logger.error('Failed to fill single marker:', error);

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            new Notice('Failed to fill placeholder: ' + errorMessage);

            // Display error in chat
            if (this.plugin.sidebarView?.chatRenderer) {
                this.plugin.sidebarView.chatRenderer.addErrorMessage(
                    `Failed to fill placeholder at line ${targetMarker.line + 1}: ${errorMessage}`,
                    true
                );
            }
        } finally {
            this.abortController = null;
        }
    }

    /**
     * Execute /fill command - fill all markers sequentially with streaming typewriter effect
     */
    async executeFill(): Promise<void> {

        const documentContext = this.documentEngine.getDocumentContext();
        if (!documentContext) {
            new Notice('No active document found');
            return;
        }

        const markers = this.detectMarkers(documentContext.content);

        if (markers.length === 0) {
            new Notice('No placeholders found in document');
            return;
        }

        const activeEditor = this.documentEngine.getActiveEditor();
        if (!activeEditor) {
            new Notice('No active editor available');
            return;
        }

        this.logger.info(`Found ${markers.length} markers to fill sequentially with streaming`);

        // Create abort controller for this batch operation
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        // Process markers top-to-bottom for natural reading order
        const sortedMarkers = [...markers].sort((a, b) => a.position - b.position);

        let successCount = 0;
        let failCount = 0;
        const filledMarkers: MarkerInsight[] = [];
        const filledInstructions = new Set<string>(); // Track filled markers by instruction

        try {
            for (let i = 0; i < sortedMarkers.length; i++) {
                // Check if operation was aborted
                if (signal.aborted) {
                    break; // Exit marker loop
                }

                const markerNum = i + 1;

                try {
                    // Re-detect markers after each fill to get updated positions
                    // (positions shift as we fill from top to bottom)
                    const currentDocContext = this.documentEngine.getDocumentContext();
                    if (!currentDocContext) {
                        throw new Error('Document context lost during batch fill');
                    }

                    const currentMarkers = this.detectMarkers(currentDocContext.content);

                    // Find the next unfilled marker (by instruction)
                    const unfilledMarker = currentMarkers.find(m => !filledInstructions.has(m.instruction));

                    if (!unfilledMarker) {
                        // All remaining markers have been filled
                        break;
                    }

                    this.logger.info(`Filling marker ${markerNum}/${sortedMarkers.length} at line ${unfilledMarker.line + 1}: ${unfilledMarker.instruction}`);

                    // Show thinking notice for this marker
                    this.streamingManager.showThinkingNotice('edit', 'notice');

                    const prompt = this.buildSingleFillPrompt(currentDocContext.content, unfilledMarker);

                    // Calculate positions for marker replacement
                    const startPos = activeEditor.offsetToPos(unfilledMarker.position);
                    const endPos = activeEditor.offsetToPos(unfilledMarker.position + unfilledMarker.length);

                    // Start streaming to replace the marker with typewriter effect
                    const streaming = this.streamingManager.startStreaming(
                        activeEditor,
                        startPos,
                        endPos,
                        {
                            animationMode: 'inline',
                            scrollBehavior: 'smooth'
                        }
                    );

                    // Get AI response with streaming
                    let fullContent = '';
                    const stream = this.providerManager.generateTextStream(
                        prompt,
                        {
                            systemPrompt: 'You are a helpful writing assistant. Generate high-quality content that matches the style and tone of the surrounding document.',
                            temperature: 0.7,
                            maxTokens: 2000,
                            signal: signal
                        }
                    );

                    // Handle streaming updates with typewriter effect
                    for await (const chunk of stream) {
                        if (signal.aborted) {
                            streaming.stopStream();
                            break;
                        }
                        if (chunk.content) {
                            fullContent += chunk.content;
                            streaming.updateStream(fullContent, false);
                        }
                    }

                    // Complete the stream if not aborted
                    if (!signal.aborted) {
                        streaming.updateStream(fullContent, true);
                        this.streamingManager.stopAnimation();

                        // Mark this marker as filled
                        filledInstructions.add(unfilledMarker.instruction);
                        successCount++;
                        filledMarkers.push(unfilledMarker);
                    } else {
                        // Aborted during streaming
                        this.streamingManager.stopAnimation();
                        break;
                    }

                } catch (error) {
                    this.streamingManager.stopAnimation();
                    this.logger.error(`Failed to fill marker ${markerNum}:`, error);

                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

                    // Show error in chat for this specific marker
                    if (this.plugin.sidebarView?.chatRenderer) {
                        this.plugin.sidebarView.chatRenderer.addErrorMessage(
                            `Failed to fill placeholder ${markerNum}/${sortedMarkers.length}: ${errorMessage}`,
                            true
                        );
                    }

                    failCount++;
                    // Continue with next marker despite error
                }
            }

            // Show final summary in Notice only
            if (signal.aborted) {
                // Show canceled message in chat (matching context menu format)
                // Message must be >30 chars for bubble format, don't include ❌ (auto-added)
                try {
                    const sidebarView = this.plugin.getCurrentSidebarView();
                    if (sidebarView?.chatRenderer) {
                        sidebarView.chatRenderer.addErrorMessage(
                            `Operation canceled: fill (${successCount} of ${sortedMarkers.length} completed)`,
                            true
                        );
                    }
                } catch (error) {
                    this.logger.warn('Failed to add cancel message to chat:', error);
                }
                new Notice(`Fill canceled (${successCount} of ${sortedMarkers.length} completed)`);
            } else if (successCount > 0 && failCount === 0) {
                new Notice(`Filled ${successCount} placeholder${successCount > 1 ? 's' : ''}`);
            } else if (successCount > 0 && failCount > 0) {
                new Notice(`Filled ${successCount}/${successCount + failCount} placeholders (${failCount} failed)`);

                // Show summary error in chat if some failed
                if (this.plugin.sidebarView?.chatRenderer) {
                    this.plugin.sidebarView.chatRenderer.addErrorMessage(
                        `Batch fill completed with errors: ${successCount} succeeded, ${failCount} failed`,
                        true
                    );
                }
            } else {
                new Notice('Failed to fill placeholders');

                // Show error in chat if all failed
                if (this.plugin.sidebarView?.chatRenderer) {
                    this.plugin.sidebarView.chatRenderer.addErrorMessage(
                        'Failed to fill all placeholders',
                        true
                    );
                }
            }
        } finally {
            this.abortController = null;
        }
    }

    /**
     * Build prompt for filling a single marker with full document context
     */
    private buildSingleFillPrompt(document: string, marker: MarkerInsight): string {
        return `You are helping a writer fill in a placeholder marker in their document.

TASK: Generate content for this specific instruction:
"${marker.instruction}"

Here is the full document for context:
---
${document}
---

CRITICAL INSTRUCTIONS:
1. Generate content ONLY for the instruction: "${marker.instruction}"
2. Consider the full document context to ensure coherence
3. Return ONLY the generated content - no explanations, no marker comments, no wrapper text
4. The content should match the document's style and tone

Generate the content now:`;
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
            const resolvedVariables = this.resolveVariables(command.variables, context);
            
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
    private resolveVariables(
        variables: TemplateVariable[],
        context: SmartContext
    ): Record<string, string> {
        const resolved: Record<string, string> = {};

        for (const variable of variables) {
            const value = this.resolveVariable(variable, context);
            resolved[variable.name] = value;
        }

        return resolved;
    }

    /**
     * Resolve a single template variable
     */
    private resolveVariable(
        variable: TemplateVariable,
        context: SmartContext
    ): string {
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
            const documentContext = this.documentEngine.getDocumentContext();
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
            // Get cursor positions directly to ensure proper selection detection
            const cursorFrom = activeEditor.getCursor('from');
            const cursorTo = activeEditor.getCursor('to');
            const selection = activeEditor.getSelection();
            
            // Determine if we have a selection by comparing positions
            const hasSelection = (cursorFrom.line !== cursorTo.line || cursorFrom.ch !== cursorTo.ch);
            const endPos = hasSelection ? cursorTo : undefined;
            
            this.logger.debug(`Setting up streaming: hasSelection=${hasSelection}, selectionLength=${selection.length}, from=${cursorFrom.line}:${cursorFrom.ch}, to=${cursorTo.line}:${cursorTo.ch}`);
            
            const streaming = this.streamingManager.startStreaming(
                activeEditor,
                cursorFrom,
                endPos,
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

            // Complete the stream (this handles cursor positioning automatically)
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
     * Cancel the current ongoing operation
     */
    cancelCurrentOperation(): void {
        this.abortController?.abort();
        this.streamingManager.stopAnimation();
    }

    /**
     * Cleanup method for plugin unload
     */
    cleanup(): void {
        this.logger.info('CommandEngine cleaned up');
    }
}