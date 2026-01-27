/**
 * @file DocumentAnalyzer - Analyzes document structure and metadata
 */

export interface DocumentStructure {
	headings: Array<{ level: number; text: string; isEmpty: boolean }>;
	wordCount: number;
	emptyHeadings: string[];
	incompleteBullets: string[];
}

export class DocumentAnalyzer {
	static analyzeStructure(content: string): DocumentStructure {
		const lines = content.split('\n');
		const headings: Array<{ level: number; text: string; isEmpty: boolean }> = [];
		const emptyHeadings: string[] = [];
		const incompleteBullets: string[] = [];
		
		// Find headings and analyze content after each
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
			
			if (headingMatch) {
				const level = headingMatch[1].length;
				const text = headingMatch[2];
				
				// Check if heading has content after it
				const hasContent = this.hasContentAfterHeading(lines, i);
				const isEmpty = !hasContent;
				
				headings.push({ level, text, isEmpty });
				
				if (isEmpty) {
					emptyHeadings.push(text);
				}
			}
			
			// Find incomplete bullet points (ending with "..." or empty)
			if (line.match(/^[-*+]\s*(.*)\.\.\.?\s*$/) || line.match(/^[-*+]\s*$/) || line.match(/^[-*+]\s*(TODO|TBD)/i)) {
				incompleteBullets.push(line);
			}
		}
		
		const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
		
		return {
			headings,
			wordCount,
			emptyHeadings,
			incompleteBullets
		};
	}
	
	private static hasContentAfterHeading(lines: string[], headingIndex: number): boolean {
		const currentHeading = lines[headingIndex].trim();
		const currentLevel = currentHeading.match(/^(#{1,6})/)?.[1].length || 0;
		
		for (let i = headingIndex + 1; i < lines.length; i++) {
			const line = lines[i].trim();
			
			// Check if this is a heading
			const headingMatch = line.match(/^(#{1,6})\s/);
			if (headingMatch) {
				const nextLevel = headingMatch[1].length;
				
				// If next heading is same or higher level (lower number), 
				// and we haven't found content yet, this section is empty
				if (nextLevel <= currentLevel) {
					return false;
				}
				// If it's a sub-heading (higher number), continue looking for content
				// This allows for H1 → H2 structure without counting as empty
			}
			
			// If we find substantial content (not just whitespace), heading is not empty
			if (line.length > 0) return true;
		}
		
		// If we reach end of document without finding content, it's empty
		return false;
	}
}