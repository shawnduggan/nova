/**
 * @file Release notes content for each version.
 *
 * Add an entry before running `npm version`. Old entries can be pruned (keep ~5).
 */

export const RELEASE_NOTES: Record<string, string> = {
	// Add entries before running `npm version`. The /release command handles this.
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
	'1.2.1': [
		'## What\'s New in Nova 1.2.1',
		'',
		'### Notice Reliability Fix',
		'Fixed an issue where thinking notices ("analyzing...", "refining...") could permanently stop appearing after 30 seconds. This also affected error messages and other notifications. Notices now persist correctly until dismissed.',
	].join('\n'),
	'1.2.0': [
		'## What\'s New in Nova 1.2.0',
		'',
		'### Challenge This',
		'Select any argument or claim, right-click, and choose "Challenge This." Nova identifies logical gaps, unsupported claims, and counter-arguments — delivered straight to the sidebar chat so you can refine your thinking without losing your original text.',
		'',
		'### Custom Prompt History',
		'The custom prompt modal now remembers your recent instructions. Quickly reuse previous prompts instead of retyping them.',
		'',
		'### Thinking Notices Fixed',
		'Rotating status notices ("refining...", "analyzing...") now appear reliably for all context menu commands, smart fill, and Challenge This. Previously these could fail to display after the first use.',
		'',
		'### Stability',
		'- Conversation manager initialization is now idempotent, preventing potential issues on reload',
	].join('\n'),
	'1.1.2': [
		'## What\'s New in Nova 1.1.2',
		'',
		'### Stability & Reliability',
		'This release focuses on internal stability improvements that make Nova more reliable:',
		'',
		'- **Improved plugin lifecycle** — Event listeners now register at the correct time during sidebar initialization, preventing potential issues on first load',
		'- **Better timer management** — All internal timers are now properly tracked for clean plugin shutdown',
		'- **Safer startup sequence** — Conversation data loading no longer races with plugin initialization',
		'- **Reduced memory usage** — Eliminated a redundant internal component that was being created twice',
	].join('\n'),
};

/**
 * Get release notes markdown for a given version, or null if none exist.
 */
export function getReleaseNotes(version: string): string | null {
	return RELEASE_NOTES[version] ?? null;
}
