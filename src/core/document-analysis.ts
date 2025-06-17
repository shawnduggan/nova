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
		for (let i = headingIndex + 1; i < lines.length; i++) {
			const line = lines[i].trim();
			
			// Stop if we hit another heading
			if (line.match(/^#{1,6}\s/)) break;
			
			// If we find non-empty content, heading is not empty
			if (line.length > 0) return true;
		}
		return false;
	}
}