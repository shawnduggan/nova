/**
 * CommandEngine - Core system for executing commands and the /fill command
 * Handles template processing and AI execution coordination
 */

import { Notice } from 'obsidian';
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

export class CommandEngine {
    private plugin: NovaPlugin;
    private streamingManager: StreamingManager;
    private providerManager: AIProviderManager;
    private contextBuilder: ContextBuilder;
    private documentEngine: DocumentEngine;
    private logger = Logger.scope('CommandEngine');

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
     */
    async executeFillSingle(lineNumber: number): Promise<void> {
        const documentContext = this.documentEngine.getDocumentContext();
        if (!documentContext) {
            new Notice('No active document found');
            return;
        }

        const markers = this.detectMarkers(documentContext.content);
        const targetMarker = markers.find(m => m.line === lineNumber);

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

        try {
            // Show thinking notice for duration of fill operation
            this.streamingManager.showThinkingNotice('edit', 'notice');

            await this.fillSingleMarkerInternal(targetMarker, documentContext.content, activeEditor);

            // Hide thinking notice when complete
            this.streamingManager.stopAnimation();

            // Display success message in chat UI
            const chatMessage = `Filled placeholder at line ${targetMarker.line + 1}: ${targetMarker.instruction}`;

            if (this.plugin.sidebarView?.chatRenderer) {
                this.plugin.sidebarView.chatRenderer.addSuccessMessage(chatMessage, true);
            }

            // Also record to conversation
            await this.documentEngine.addSystemMessage(chatMessage);

            new Notice('Filled placeholder');
        } catch (error) {
            this.streamingManager.stopAnimation();
            this.logger.error('Failed to fill single marker:', error);
            new Notice('Failed to fill placeholder: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    /**
     * Execute /fill command - fill all markers sequentially with progressive context
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

        this.logger.info(`Found ${markers.length} markers to fill sequentially`);
        this.streamingManager.showThinkingNotice('edit', 'notice');

        try {
            const filledMarkers: MarkerInsight[] = [];

            // Fill markers one at a time (in document order)
            for (const originalMarker of markers) {
                // Get fresh document content (includes previous fills)
                const freshContent = activeEditor.getValue();
                const freshMarkers = this.detectMarkers(freshContent);

                // Find this marker in the fresh content by matching instruction
                const currentMarker = freshMarkers.find(m => m.instruction === originalMarker.instruction);

                if (currentMarker) {
                    await this.fillSingleMarkerInternal(currentMarker, freshContent, activeEditor);
                    filledMarkers.push(originalMarker);
                }
            }

            // All fills complete - stop the thinking notice
            this.streamingManager.stopAnimation();

            // Display success message
            const markerSummary = filledMarkers.map((m, i) => `${i + 1}. Line ${m.line + 1}: ${m.instruction}`).join('\n');
            const chatMessage = `Filled ${filledMarkers.length} placeholder${filledMarkers.length > 1 ? 's' : ''}:\n${markerSummary}`;

            if (this.plugin.sidebarView?.chatRenderer) {
                this.plugin.sidebarView.chatRenderer.addSuccessMessage(chatMessage, true);
            }
            await this.documentEngine.addSystemMessage(chatMessage);
            new Notice(`Filled ${filledMarkers.length} placeholder${filledMarkers.length > 1 ? 's' : ''}`);

        } catch (error) {
            this.streamingManager.stopAnimation();
            this.logger.error('Failed to execute /fill:', error);
            new Notice('Failed to fill placeholders: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    /**
     * Fill a single marker with AI-generated content (internal helper)
     * Used by both executeFillSingle and executeFill
     */
    private async fillSingleMarkerInternal(
        marker: MarkerInsight,
        content: string,
        activeEditor: import('obsidian').Editor
    ): Promise<void> {
        // Get surrounding context (a few lines before and after)
        const lines = content.split('\n');
        const contextStart = Math.max(0, marker.line - 3);
        const contextEnd = Math.min(lines.length, marker.line + 4);
        const surroundingContext = lines.slice(contextStart, contextEnd).join('\n');

        // Build prompt for single marker
        const prompt = `You are helping a writer fill in a placeholder marker in their document.

TASK: Generate content for this ONE specific instruction:
"${marker.instruction}"

Surrounding context for reference (the marker is on line ${marker.line + 1}):
---
${surroundingContext}
---

CRITICAL INSTRUCTIONS:
1. Generate content ONLY for the instruction: "${marker.instruction}"
2. Do NOT generate content for any other markers you see in the context
3. Return ONLY the generated content - no explanations, no marker comments, no wrapper text
4. The content should be concise and fit naturally with the surrounding text

Generate the content now:`;

        // Calculate positions for marker replacement
        const startPos = activeEditor.offsetToPos(marker.position);
        const endPos = activeEditor.offsetToPos(marker.position + marker.length);

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
                maxTokens: 2000
            }
        );

        // Handle streaming updates
        for await (const chunk of stream) {
            if (chunk.content) {
                fullContent += chunk.content;
                streaming.updateStream(fullContent, false);
            }
        }

        // Complete the stream (finalizes cursor position)
        streaming.updateStream(fullContent, true);

        // Note: NOT calling streaming.stopStream() here - it would stop the thinking notice
        // The calling method (executeFill/executeFillSingle) manages the notice lifecycle

        this.logger.debug('AI response for marker fill completed, length:', fullContent.length);
    }

    /**
     * Build prompt for filling all markers
     */
    private buildFillPrompt(content: string, markers: MarkerInsight[]): string {
        const markerInstructions = markers.map((marker, index) =>
            `[MARKER ${index + 1}] Line ${marker.line + 1}: ${marker.instruction}`
        ).join('\n');

        return `You are helping a writer fill in placeholder markers in their document.

The document contains ${markers.length} marker(s) that need content generated. Each marker is in the format <!-- nova: instruction -->.

Here are the markers and their instructions:
${markerInstructions}

Document context (for reference):
---
${content}
---

IMPORTANT INSTRUCTIONS:
1. Generate content for EACH marker based on its instruction
2. Return your response in the EXACT format below, with each marker's content clearly labeled
3. The content should fit naturally with the surrounding document context
4. Do NOT include the marker comments in your response - just the generated content

Response format:
[MARKER 1]
(generated content for marker 1)

[MARKER 2]
(generated content for marker 2)

... and so on for each marker.

Generate the content now:`;
    }

    /**
     * Execute fill with streaming and replace markers
     */
    private async executeWithStreamingForFill(
        prompt: string,
        markers: MarkerInsight[],
        originalContent: string
    ): Promise<void> {
        const activeEditor = this.documentEngine.getActiveEditor();
        if (!activeEditor) {
            throw new Error('No active editor available');
        }

        // Get AI response (non-streaming for fill since we need to parse it)
        const response = await this.providerManager.generateText(
            prompt,
            {
                systemPrompt: 'You are a helpful writing assistant. Generate high-quality content that matches the style and tone of the surrounding document.',
                temperature: 0.7,
                maxTokens: 4000
            }
        );

        // Debug logging for response
        this.logger.debug('AI response for /fill:', response);
        this.logger.debug('Response length:', response.length);
        this.logger.debug('Marker count:', markers.length);

        // Parse the response to extract content for each marker
        const markerContents = this.parseMarkerResponse(response, markers.length);

        // Replace markers from end to start to preserve positions
        let newContent = originalContent;
        for (let i = markers.length - 1; i >= 0; i--) {
            const marker = markers[i];
            const content = markerContents[i] || '[Content generation failed]';

            // Log error if content generation failed for this marker
            if (!markerContents[i]) {
                this.logger.error(`Content generation failed for marker ${i + 1} (line ${marker.line + 1}): "${marker.instruction}"`);
            }

            newContent = newContent.substring(0, marker.position) +
                        content +
                        newContent.substring(marker.position + marker.length);
        }

        // Replace entire document content
        const lastLine = activeEditor.lastLine();
        const lastLineLength = activeEditor.getLine(lastLine).length;
        activeEditor.replaceRange(
            newContent,
            { line: 0, ch: 0 },
            { line: lastLine, ch: lastLineLength }
        );
    }

    /**
     * Parse AI response to extract content for each marker
     */
    private parseMarkerResponse(response: string, markerCount: number): string[] {
        const contents: string[] = [];

        // For single marker, use entire response if no marker pattern found
        if (markerCount === 1) {
            const markerPattern = /\[MARKER\s*1\]/i;
            if (markerPattern.test(response)) {
                // Has marker wrapper - extract content after it
                const match = response.match(/\[MARKER\s*1\]\s*\n?([\s\S]*)/i);
                contents.push(match ? match[1].trim() : response.trim());
            } else {
                // No wrapper - use entire response
                this.logger.debug('Single marker: no wrapper found, using entire response');
                contents.push(response.trim());
            }
            return contents;
        }

        // For multiple markers, use flexible matching
        for (let i = 1; i <= markerCount; i++) {
            // Try multiple patterns
            const patterns = [
                new RegExp(`\\[MARKER\\s*${i}\\]\\s*\\n?`, 'i'),
                new RegExp(`\\*\\*\\[MARKER\\s*${i}\\]\\*\\*\\s*\\n?`, 'i'),
                new RegExp(`MARKER\\s*${i}:?\\s*\\n?`, 'i'),
            ];

            let startIndex = -1;
            let matchLength = 0;

            for (const pattern of patterns) {
                const match = pattern.exec(response);
                if (match) {
                    startIndex = match.index + match[0].length;
                    matchLength = match[0].length;
                    break;
                }
            }

            if (startIndex === -1) {
                this.logger.warn(`Could not find MARKER ${i} in response`);
                contents.push('');
                continue;
            }

            // Find end (next marker or end of string)
            let endIndex = response.length;
            if (i < markerCount) {
                for (const pattern of patterns.map(p =>
                    new RegExp(p.source.replace(String(i), String(i + 1)), 'i')
                )) {
                    const endMatch = pattern.exec(response.substring(startIndex));
                    if (endMatch) {
                        endIndex = startIndex + endMatch.index;
                        break;
                    }
                }
            }

            contents.push(response.substring(startIndex, endIndex).trim());
        }

        return contents;
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
     * Cleanup method for plugin unload
     */
    cleanup(): void {
        this.logger.info('CommandEngine cleaned up');
    }
}