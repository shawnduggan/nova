/**
 * @file Release notes content for each version.
 *
 * Add an entry before running `npm version`. Old entries can be pruned (keep ~5).
 */

export const RELEASE_NOTES: Record<string, string> = {
	// Add entries before running `npm version`. The /release command handles this.
	'1.5.3': [
		'## What\'s New in Nova 1.5.3',
		'',
		'### New Models',
		'- **Claude Opus 4.7** and **GPT-5.5** are now selectable in the model picker for their respective providers.',
		'',
		'### Bug Fixes',
		'- **Further reduced typing freezes in long notes.** 1.5.2 cut the problem back but didn\'t eliminate it. The scheduler now defers analysis to a browser idle slice once the debounce fires, so if you keep typing past the debounce, the work yields to your keystrokes instead of blocking them. The analyzer itself also does less work per run: duplicate passive-voice scans were removed, position lookups are deduped, and lines with no inline code skip an unnecessary per-character copy.',
	].join('\n'),
	'1.5.2': [
		'## What\'s New in Nova 1.5.2',
		'',
		'### Bug Fixes',
		'- **Typing no longer freezes in long notes.** The Writing Analysis subsystem was running a full-document scan after every short typing pause and accumulating memory in an unbounded cache. In long drafts this produced momentary keyboard unresponsiveness that resolved on its own or required a plugin reload. The cache is now bounded to a single entry, and the analysis debounce was raised from 500 ms to 1500 ms so ordinary mid-word pauses no longer trigger re-analysis.',
		'- **Very large documents skip live analysis.** Documents over 50,000 characters no longer run analysis on every keystroke, keeping the editor responsive while editing book-length drafts. Use the **Analyze** button in the sidebar to run analysis on demand.',
		'',
		'### Under the Hood',
		'- Tightened the Writing Analysis scheduling path so it skips cleanly when the editor isn\'t ready, instead of scheduling work against a not-yet-wired-up view.',
		'- Replaced an inline style assignment on the context budget bar with a CSS custom property, aligning with the rest of the plugin\'s Obsidian compliance patterns.',
	].join('\n'),
	'1.5.1': [
		'## What\'s New in Nova 1.5.1',
		'',
		'### Bug Fixes',
		'- **Writing Analysis panel no longer disappears when clicking the file navigator.** Previously, clicking from an active editor into the file explorer cleared the panel. It now stays visible until you open a different document.',
	].join('\n'),
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
};

/**
 * Get release notes markdown for a given version, or null if none exist.
 */
export function getReleaseNotes(version: string): string | null {
	return RELEASE_NOTES[version] ?? null;
}
