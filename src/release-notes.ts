/**
 * @file Release notes content for each version.
 *
 * Add an entry before running `npm version`. Old entries can be pruned (keep ~5).
 */

export const RELEASE_NOTES: Record<string, string> = {
	// Add entries before running `npm version`. The /release command handles this.
	'1.5.0': [
		'## What\'s New in Nova 1.5.0',
		'',
		'### Writing Dashboard',
		'Nova now includes a **vault-wide writing dashboard** that turns local analysis into a broader writing view — no AI calls needed.',
		'',
		'- **Composite writing score** — Clarity, conciseness, variety, and discipline combine into a single score for eligible notes.',
		'- **Vault scan with caching** — Notes are analyzed incrementally and cached locally for faster follow-up scans.',
		'- **Trend tracking** — Daily snapshots show how score and passive voice change over time.',
		'- **Document table** — Sort and filter notes by score, readability, passive voice, and adverb density.',
		'- **Explainability tooltips** — Hover any metric to see how Nova interpreted it.',
		'',
		'### Settings',
		'- **Folder exclusions** — Skip templates, journals, archives, or any other folders from dashboard analysis.',
		'- **Target readability grade** — Adjust the clarity target to match your writing goals.',
	].join('\n'),
	'1.4.0': [
		'## What\'s New in Nova 1.4.0',
		'',
		'### Writing Analysis',
		'Nova now includes a **deterministic writing analysis** panel that runs locally — no AI calls needed.',
		'',
		'- **Readability grade** — Flesch-Kincaid grade level with a plain-language label (e.g. "Grade 7 — easy to read").',
		'- **Inline highlights** — Long sentences, very long sentences, passive voice, adverbs, and weak intensifiers are underlined directly in the editor with color-coded severity.',
		'- **Stats at a glance** — Word count, sentence count, reading time, passive voice percentage, adverb density, and intensifier count in a collapsible panel.',
		'- **Analyze button** — Re-run analysis on demand; automatically enables highlights if they\'re hidden.',
		'- **Frontmatter opt-out** — Add `nova-writing: false` to any note\'s frontmatter to disable analysis.',
		'- **Configurable thresholds** — Adjust long/very-long sentence word limits in settings.',
		'',
		'### Auto-Context Improvements',
		'- **Live wikilink tracking** — Adding or removing `[[wikilinks]]` now updates the context panel automatically (previously required switching files).',
		'',
		'### Mobile Polish',
		'- **Writing panel** — Proper touch targets, readable font sizes, and scroll behavior on mobile.',
		'- **Consistent panels** — Writing and Context panels now share identical mobile styling.',
		'- **Privacy indicator** — Left-aligned for a cleaner layout on both desktop and mobile.',
		'',
		'### Bug Fixes',
		'- Fixed undo/redo not triggering writing analysis updates.',
		'- Fixed weak intensifiers (e.g. "really") being double-highlighted as both adverbs and intensifiers.',
		'- Fixed Ollama base URL trailing slash causing connection failures.',
		'- Relaxed adverb and intensifier thresholds to reduce false alarms.',
		'- Token budget bar now hidden when usage is negligible; shows percentage instead of raw counts.',
	].join('\n'),
	'1.3.3': [
		'## What\'s New in Nova 1.3.3',
		'',
		'### Mobile Keyboard Fix',
		'- **Composer stays visible** — On mobile, the input area now stays above the on-screen keyboard instead of getting hidden behind it.',
		'- **Improved mobile layout** — Restructured the sidebar CSS for more reliable flexbox behavior on iOS and Android.',
		'- **Quick panel polish** — Better sizing and scroll behavior for the context panel on mobile devices.',
	].join('\n'),
	'1.3.2': [
		'## What\'s New in Nova 1.3.2',
		'',
		'### Bug Fixes',
		'- **Startup error fixed** — Resolved a console error caused by the Nova Commands system initializing before its components were created. The margin indicators now initialize at the correct time during plugin startup.',
		'- **Retroactive 1.3.1 release notes** — Added missing release notes for the 1.3.1 update.',
	].join('\n'),
	'1.3.1': [
		'## What\'s New in Nova 1.3.1',
		'',
		'### UI Polish',
		'- **Sidebar layout fix** — The sidebar content area now flexes correctly, preventing layout overflow issues.',
		'- **Capitalization fix** — Corrected "How can i help?" to "How can I help?" in the input placeholder.',
	].join('\n'),
	'1.3.0': [
		'## What\'s New in Nova 1.3.0',
		'',
		'### Auto-Context: Your Knowledge Graph, Built In',
		'Nova now automatically understands your knowledge graph. When you open a note, Nova resolves its **outgoing wikilinks** and optionally its **backlinks**, pulling the content of linked notes into the AI\'s context window — no manual references in chat required.',
		'',
		'- **Section links** like `[[Note#Heading]]` include only that section, keeping token usage tight.',
		'- **Large documents** are intelligently truncated — small docs are included in full, large ones get their most relevant sections.',
		'- **Backlinks** can be enabled for bidirectional awareness (off by default to save tokens).',
		'- Everything is visible and controllable in the new **Context Quick Panel**.',
		'',
		'### Context Quick Panel',
		'The old context drawer has been replaced with a compact, collapsible quick panel at the top of the sidebar:',
		'',
		'- **At a glance:** See how many notes are in context, total token count, and budget usage with a visual progress bar.',
		'- **Toggle controls:** Turn auto-include linked notes and backlinks on/off without leaving the conversation.',
		'- **Document list:** See every context document, its source (linked, backlink, or manual), and token count. Remove any with one tap.',
		'- **Mobile-optimized:** Larger touch targets, readable font sizes, and theme-aware styling.',
		'',
		'### Model Catalog',
		'- Added **Claude Sonnet 4.6** and **Gemini 3.1 Pro (Preview)**.',
		'- Removed legacy models (Claude Opus 4.5, Claude Sonnet 4.5).',
	].join('\n'),
};

/**
 * Get release notes markdown for a given version, or null if none exist.
 */
export function getReleaseNotes(version: string): string | null {
	return RELEASE_NOTES[version] ?? null;
}
