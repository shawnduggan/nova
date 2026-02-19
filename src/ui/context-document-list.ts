/**
 * @file ContextDocumentList - Flat list of context documents
 * This component is integrated into ContextQuickPanel for the sidebar.
 * It can be used independently for the Auto-Context System.
 */

import type { MultiDocContext } from './context-manager';

/**
 * Interface for context document items
 */
export interface ContextDocumentItem {
    file: {
        basename: string;
        path: string;
    };
    property?: string;
}

/**
 * Get document items from context
 */
export function getContextDocuments(context: MultiDocContext | null): ContextDocumentItem[] {
    if (!context?.persistentDocs) {
        return [];
    }
    return context.persistentDocs.filter(doc => doc?.file?.basename);
}

/**
 * Format document name with property suffix
 */
export function formatDocumentName(doc: ContextDocumentItem): string {
    const suffix = doc.property ? `#${doc.property}` : '';
    return `${doc.file.basename}${suffix}`;
}

/**
 * Get truncated document names for display
 */
export function getDocumentDisplayNames(
    docs: ContextDocumentItem[], 
    maxVisible: number = 2
): { names: string[]; moreCount: number } {
    const visibleDocs = docs.slice(0, maxVisible);
    const names = visibleDocs.map(doc => doc.file.basename);
    const moreCount = docs.length > maxVisible ? docs.length - maxVisible : 0;
    return { names, moreCount };
}
