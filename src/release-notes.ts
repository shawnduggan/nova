/**
 * @file Release notes content for each version.
 *
 * Add an entry before running `npm version`. Old entries can be pruned (keep ~5).
 */

export const RELEASE_NOTES: Record<string, string> = {
	// Add entries before running `npm version`. The /release command handles this.
	'1.1.1': [
		'## What\'s New in Nova 1.1.1',
		'',
		'### Gemini 3 Flash (Preview)',
		'Google\'s latest Gemini 3 Flash model is now available as a provider option. Select it from your AI provider settings to try it out.',
		'',
		'### Smart Fill for Supernova Supporters',
		'Smart Fill is now available for Supernova-tier supporters! Automatically fill in note properties and frontmatter using AI. General availability coming April 1.',
		'',
		'### What\'s New Page',
		'Nova now shows a "What\'s New" page after plugin updates so you can see the latest changes at a glance.',
	].join('\n'),
};

/**
 * Get release notes markdown for a given version, or null if none exist.
 */
export function getReleaseNotes(version: string): string | null {
	return RELEASE_NOTES[version] ?? null;
}
