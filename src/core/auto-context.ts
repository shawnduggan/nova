/**
 * @file AutoContext - Automatic context population from wikilinks
 *
 * Resolves outgoing links and backlinks from the current document
 * to automatically populate the context panel.
 */

import { App, TFile, CachedMetadata, HeadingCache } from 'obsidian';
import { Logger } from '../utils/logger';

/** Source of a context document */
export type ContextSource = 'linked' | 'backlink' | 'manual';

/** Document entry in auto-context */
export interface AutoContextDocument {
	/** The file being referenced */
	file: TFile;
	/** How this document was added to context */
	source: ContextSource;
	/** Specific section/heading if using [[Doc#Section]] syntax */
	section?: string;
	/** Token count estimate */
	tokenCount: number;
	/** Full token count (if truncated) */
	fullTokenCount?: number;
	/** Whether content is truncated */
	isTruncated: boolean;
	/** Sections included if truncated */
	includedSections?: string[];
}

/** Options for auto-context resolution */
export interface AutoContextOptions {
	/** Include outgoing links (default: true) */
	includeOutgoing: boolean;
	/** Include backlinks (default: false) */
	includeBacklinks: boolean;
	/** Token limit for small documents (full content) */
	smallDocThreshold: number;
	/** Token limit for medium documents (full content with warning) */
	mediumDocThreshold: number;
	/** Max tokens to include from large documents */
	largeDocMaxTokens: number;
	/** Min content length to include (skip empty files) */
	minContentLength: number;
}

export const DEFAULT_AUTO_CONTEXT_OPTIONS: AutoContextOptions = {
	includeOutgoing: true,
	includeBacklinks: false,
	smallDocThreshold: 2000,
	mediumDocThreshold: 8000,
	largeDocMaxTokens: 2000,
	minContentLength: 10
};

/**
 * Calculates token count from text (rough approximation: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * Extracts content between headings from document content
 */
export function extractSectionContent(
	content: string,
	targetHeading: string,
	headings: HeadingCache[]
): string | null {
	const lines = content.split('\n');
	
	// Find the target heading
	const targetIndex = headings.findIndex(h => 
		h.heading.toLowerCase() === targetHeading.toLowerCase()
	);
	
	if (targetIndex === -1) return null;
	
	const targetHeadingInfo = headings[targetIndex];
	const startLine = targetHeadingInfo.position.start.line;
	
	// Find the next heading of equal or higher level (smaller number = higher level)
	let endLine = lines.length;
	for (let i = targetIndex + 1; i < headings.length; i++) {
		if (headings[i].level <= targetHeadingInfo.level) {
			endLine = headings[i].position.start.line;
			break;
		}
	}
	
	// Extract content between start and end
	const sectionLines = lines.slice(startLine, endLine);
	return sectionLines.join('\n');
}

/**
 * Smart truncation for large documents
 */
export interface TruncationResult {
	content: string;
	tokenCount: number;
	fullTokenCount: number;
	isTruncated: boolean;
	includedSections: string[];
}

export async function truncateDocumentContent(
	app: App,
	file: TFile,
	options: Pick<AutoContextOptions, 'largeDocMaxTokens' | 'minContentLength'>,
	section?: string,
	existingContent?: string
): Promise<TruncationResult | null> {
	try {
		// Use existing content if provided, otherwise read from disk
		const content = existingContent || await app.vault.cachedRead(file);
		
		if (content.length < options.minContentLength) {
			return null;
		}
		
		const fullTokenCount = estimateTokens(content);
		const cache = app.metadataCache.getFileCache(file);
		const headings = cache?.headings || [];
		
		// If specific section requested, try to extract just that section
		if (section && headings.length > 0) {
			const sectionContent = extractSectionContent(content, section, headings);
			if (sectionContent) {
				const sectionTokens = estimateTokens(sectionContent);
				return {
					content: sectionContent,
					tokenCount: sectionTokens,
					fullTokenCount,
					isTruncated: true,
					includedSections: [section]
				};
			}
		}
		
		// Smart truncation for large documents
		const lines = content.split('\n');
		const includedSections: string[] = [];
		const contentParts: string[] = [];
		let currentTokens = 0;
		const maxTokens = options.largeDocMaxTokens;
		
		// Always include document header
		contentParts.push(`## Document: ${file.basename}`);
		currentTokens += estimateTokens(contentParts[0]);
		
		// Add frontmatter if present
		if (cache?.frontmatter && Object.keys(cache.frontmatter).length > 0) {
			const fmLines = ['\n### Properties/Metadata:'];
			for (const [key, value] of Object.entries(cache.frontmatter)) {
				const formattedValue = typeof value === 'object' ? JSON.stringify(value) : value;
				fmLines.push(`- ${key}: ${String(formattedValue)}`);
			}
			const fmContent = fmLines.join('\n');
			contentParts.push(fmContent);
			currentTokens += estimateTokens(fmContent);
		}
		
		// Include headings structure for orientation
		if (headings.length > 0) {
			const headingsContent = '\n### Document Structure:\n' + 
				headings.slice(0, 20).map(h => `${'#'.repeat(h.level)} ${h.heading}`).join('\n');
			contentParts.push(headingsContent);
			currentTokens += estimateTokens(headingsContent);
			includedSections.push('Document Structure');
		}
		
		// Add introduction/first part of content up to token limit
		const remainingTokens = maxTokens - currentTokens;
		if (remainingTokens > 100) {
			// Skip frontmatter in content
			let contentStartIndex = 0;
			if (lines[0] === '---') {
				for (let i = 1; i < lines.length; i++) {
					if (lines[i] === '---') {
						contentStartIndex = i + 1;
						break;
					}
				}
			}
			
			const contentLines = lines.slice(contentStartIndex);
			let introText = '';
			let introTokens = 0;
			let lineIndex = 0;
			
			// Track running token count instead of re-estimating full string each iteration (O(n) vs O(n²))
			while (lineIndex < contentLines.length && introTokens < remainingTokens) {
				const line = contentLines[lineIndex] + '\n';
				introText += line;
				introTokens += estimateTokens(line);
				lineIndex++;
			}
			
			if (introText.trim()) {
				contentParts.push('\n### Introduction:\n' + introText.trim());
				includedSections.push('Introduction');
			}
		}
		
		const finalContent = contentParts.join('\n');
		return {
			content: finalContent,
			tokenCount: estimateTokens(finalContent),
			fullTokenCount,
			isTruncated: true,
			includedSections
		};
		
	} catch (error) {
		Logger.debug('Failed to truncate document content', { error });
		return null;
	}
}

/**
 * Main AutoContext service class
 */
export class AutoContextService {
	private app: App;
	private options: AutoContextOptions;

	constructor(app: App, options: Partial<AutoContextOptions> = {}) {
		this.app = app;
		this.options = { ...DEFAULT_AUTO_CONTEXT_OPTIONS, ...options };
	}

	/**
	 * Update options
	 */
	setOptions(options: Partial<AutoContextOptions>): void {
		this.options = { ...this.options, ...options };
	}

	/**
	 * Get current options
	 */
	getOptions(): AutoContextOptions {
		return { ...this.options };
	}

	/**
	 * Resolve outgoing links from a file
	 */
	resolveOutgoingLinks(file: TFile): Array<{ file: TFile; section?: string }> {
		const cache = this.app.metadataCache.getFileCache(file);
		if (!cache?.links) return [];

		const results: Array<{ file: TFile; section?: string }> = [];
		const seenPaths = new Set<string>();

		for (const link of cache.links) {
			// Parse link for section reference
			const linkMatch = link.link.match(/^([^#]+)(?:#(.+))?$/);
			if (!linkMatch) continue;

			const [, linkPath, section] = linkMatch;
			
			// Resolve the link to a file
			const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(
				linkPath,
				file.path
			);

			if (resolvedFile && !seenPaths.has(resolvedFile.path)) {
				seenPaths.add(resolvedFile.path);
				results.push({ file: resolvedFile, section });
			}
		}

		return results;
	}

	/**
	 * Resolve backlinks to a file
	 */
	resolveBacklinks(file: TFile): TFile[] {
		// Use the public resolvedLinks API - iterate in reverse to find files linking TO this file
		const resolvedLinks = this.app.metadataCache.resolvedLinks;
		if (!resolvedLinks) return [];

		const results: TFile[] = [];
		const seenPaths = new Set<string>();
		const targetPath = file.path;

		// Iterate through all resolved links to find those pointing TO our file
		for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
			if (!links || typeof links !== 'object') continue;
			
			// Check if this source links to our target
			if (targetPath in links) {
				if (seenPaths.has(sourcePath)) continue;
				seenPaths.add(sourcePath);

				const backlinkFile = this.app.vault.getFileByPath(sourcePath);
				if (backlinkFile) {
					results.push(backlinkFile);
				}
			}
		}

		return results;
	}

	/**
	 * Build auto-context for a file
	 */
	async buildAutoContext(
		file: TFile,
		existingManualDocs: TFile[] = []
	): Promise<AutoContextDocument[]> {
		const results: AutoContextDocument[] = [];
		const existingPaths = new Set(existingManualDocs.map(f => f.path));

		// Resolve outgoing links if enabled
		if (this.options.includeOutgoing) {
			const outgoing = this.resolveOutgoingLinks(file);
			
			for (const { file: linkedFile, section } of outgoing) {
				// Skip if already in manual context (outgoing takes precedence over backlink)
				if (existingPaths.has(linkedFile.path)) {
					continue;
				}

				const doc = await this.createAutoContextDocument(linkedFile, 'linked', section);
				if (doc) {
					results.push(doc);
					existingPaths.add(linkedFile.path);
				}
			}
		}

		// Resolve backlinks if enabled
		if (this.options.includeBacklinks) {
			const backlinks = this.resolveBacklinks(file);
			
			for (const backlinkFile of backlinks) {
				// Skip if already in context (outgoing takes precedence)
				if (existingPaths.has(backlinkFile.path)) {
					continue;
				}

				const doc = await this.createAutoContextDocument(backlinkFile, 'backlink');
				if (doc) {
					results.push(doc);
					existingPaths.add(backlinkFile.path);
				}
			}
		}

		return results;
	}

	/**
	 * Create an AutoContextDocument from a file
	 */
	private async createAutoContextDocument(
		file: TFile,
		source: ContextSource,
		section?: string
	): Promise<AutoContextDocument | null> {
		try {
			const content = await this.app.vault.cachedRead(file);
			
			if (content.length < this.options.minContentLength) {
				return null;
			}

			const fullTokenCount = estimateTokens(content);
			
			// Determine truncation strategy based on document size
			if (fullTokenCount < this.options.smallDocThreshold) {
				// Small document: include full content
				return {
					file,
					source,
					section,
					tokenCount: fullTokenCount,
					fullTokenCount,
					isTruncated: false
				};
			} else if (fullTokenCount < this.options.mediumDocThreshold) {
				// Medium document: include full with warning
				return {
					file,
					source,
					section,
					tokenCount: fullTokenCount,
					fullTokenCount,
					isTruncated: false
				};
			} else {
				// Large document: truncate (pass already-read content to avoid double read)
				const truncated = await truncateDocumentContent(
					this.app,
					file,
					this.options,
					section,
					content
				);
				
				if (!truncated) return null;
				
				return {
					file,
					source,
					section,
					tokenCount: truncated.tokenCount,
					fullTokenCount: truncated.fullTokenCount,
					isTruncated: true,
					includedSections: truncated.includedSections
				};
			}
		} catch (error) {
			Logger.debug('Failed to create auto-context document', { error });
			return null;
		}
	}

	/**
	 * Check if a file link exists and is valid
	 */
	isValidLink(linkPath: string, sourcePath: string): boolean {
		const resolved = this.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath);
		return resolved !== null;
	}
}
