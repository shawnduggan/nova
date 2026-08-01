/**
 * @file Release notes content for each version.
 *
 * Add an entry before running `npm version`. Old entries can be pruned (keep ~5).
 */

import { isVersionNewer } from './utils/version';

export interface ReleaseNotesEntry {
	version: string;
	content: string;
	isCurrent: boolean;
}

export const RELEASE_NOTES: Record<string, string> = {
	// Add entries before running `npm version`. The $release-nova-plugin workflow handles this.
	'1.8.3': [
		'## What\'s New in Nova 1.8.3',
		'',
		'### Reliability',
		'',
		'- **Detached windows now stay in sync.** Writing Dashboard filters and hidden states, Prose Linter review state, sidebar updates, Smart Fill indicators, resizing, and dismissal behavior now follow the Obsidian window where each view is open.',
		'- **Reloads and layout changes clean up correctly.** Nova now releases view-specific listeners, timers, and editor widgets with their owning views, avoiding stale or duplicated behavior.',
		'',
		'### Safer note and plugin data',
		'',
		'- **Metadata and tag changes use Obsidian\'s frontmatter API.** Smart Fill verifies that the same note is still active before applying AI-proposed changes and safely handles structured frontmatter values.',
		'- **Saved data is protected from overlapping writes.** Settings, conversations, and Writing Dashboard cache and history now share a serialized save path, with automatic migration of existing dashboard data.',
		'',
		'### Privacy',
		'',
		'- **Production diagnostics expose less.** Failed operations no longer include document excerpts, AI responses, provider request or response bodies, or endpoint details in production logs.',
	].join('\n'),
	'1.8.2': [
		'## What\'s New in Nova 1.8.2',
		'',
		'### Privacy and reliability',
		'',
		'- **Credential storage is more resilient.** API keys and Supernova license keys now receive stronger safeguards when Nova loads and saves settings.',
		'',
		'### Claude models',
		'',
		'- **Claude Opus 5 is available.** Anthropic\'s latest Opus model is now selectable in Nova with its 1M-token context window, alongside more reliable handling of current Claude responses.',
		'',
		'### Clearer Supernova access',
		'',
		'- **Supernova is US$29 for one year, paid once.** There is no automatic renewal; continuing after access expires requires another one-year purchase.',
		'- **Your AI provider remains separate.** Smart Revision uses a supported provider you configure, and Supernova does not include AI usage charges.',
		'- **Existing permanent licenses remain permanent.** Founding Supernova and Lifetime Supernova licenses continue to work without expiration.',
		'- **Smart Revision is now documented end to end.** The README and user guide explain its review cards, meaning risk, before-and-after impact, selective acceptance, and snapshot safety.',
		'',
		'### Policies and communications',
		'',
		'- **Our public policies now match Nova\'s current operation.** The [Terms of Service](https://novawriter.ai/terms) and [Privacy Policy](https://novawriter.ai/privacy) reflect one-year Supernova access and the website services used for checkout and privacy-friendly analytics. Existing permanent licenses remain permanent.',
		'- **The optional newsletter is paused.** New signups are closed and no newsletter launch email will be sent. Important Nova updates will continue through release notes and [novawriter.ai](https://novawriter.ai).',
		'',
		'Nova itself continues to collect zero telemetry and has no AI proxy.',
	].join('\n'),
	'1.8.1': [
		'## What\'s New in Nova 1.8.1',
		'',
		'### Sidebar polish',
		'',
		'- **The model selector stays compact without hiding important context.** The new status pill always shows the active model and whether processing is local or cloud, then opens the full selector on click or tap.',
		'- **Nova now shows one conversation state at a time.** The welcome card appears only for empty conversations, proactive “I noticed” notices have been removed, and model-switch confirmations disappear instead of becoming conversation history.',
		'- **Sidebar typography keeps the focus on your document.** Conversation text, Context, and Writing now use Obsidian’s theme-aware small UI sizing and muted colors, with a clearer two-line welcome card.',
		'- **Responsive controls stay usable.** The header, clear-conversation button, composer, and send button remain aligned and accessible across wide, narrow, desktop, and mobile sidebars.',
		'- **Context summaries count short notes correctly.** The active note and its estimated tokens no longer incorrectly appear as zero.',
		'',
		'### GPT-5.6 models',
		'',
		'- **GPT-5.6 Sol, Terra, and Luna are available.** All three can be selected in Nova and use OpenAI’s Responses API, with support for their 1.05M-token context and up to 128K output.',
	].join('\n'),
	'1.8.0': [
		'## What\'s New in Nova 1.8.0',
		'',
		'### Supernova licensing update',
		'',
		'- **Nova\'s free core stays free.** Selection editing, cursor chat, auto-context, Smart Fill, Writing Analysis, Writing Dashboard, Prose Linter, and all supported providers remain available without a Supernova license.',
		'- **Supernova unlocks Nova\'s premium features.** Smart Revision is the first, with room for more premium workflows over time.',
		'- **Existing licenses carry forward.** Annual, lifetime, and founding Supernova licenses unlock premium features.',
		'',
		'### Model picker updates',
		'',
		'- **Claude Sonnet 5 is available.** Anthropic\'s new Sonnet model is now selectable in the Claude model picker with its 1M-token context window.',
		'- **Model pickers are current.** OpenAI now shows GPT-5.5 and GPT-5.4 family models, and Gemini adds Gemini 3.5 Flash plus stable Gemini 3.1 Flash-Lite while dropping the shut-down Flash-Lite preview.',
		'',
		'### Smart Revision',
		'',
		'- **Smart Revision gives Supernova users a reviewable revision pass.** Select prose, choose Clarity, Tighten, Flow, or More Human, add an optional brief, and review Nova\'s proposal before the note changes.',
		'- **Revision cards explain the edit.** Each card shows the editorial move, rationale, receipt details, impact, risk, and accept/reject controls.',
		'- **Meaning risk is deterministic-first.** Nova checks numbers, dates, names, wikilinks, Markdown links, quoted text, negations, and protected terms; high-risk cards stay out of Accept all.',
		'- **Before/after impact uses Nova\'s local writing analysis.** The proposal shows readability, long sentences, weak phrases, passive voice, and adverb changes without extra analysis services.',
		'- **Prose Linter now bridges into Smart Revision.** Issue rows include a Smart revision action so Supernova users can move from a local issue to a controlled revision session.',
		'- **Free users can preview the workflow safely.** The preview shows a static Smart Revision card stack without generating a user-specific AI result.',
	].join('\n'),
	'1.7.1': [
		'## What\'s New in Nova 1.7.1',
		'',
		'### OpenAI-Compatible Fix',
		'',
		'- **LM Studio models activate correctly after setup.** Selecting an OpenAI-compatible model in Settings now also makes that provider active in the sidebar, fixing a state issue where Nova could show the model but still report "No provider."',
	].join('\n'),
};

/**
 * Get release notes markdown for a given version, or null if none exist.
 */
export function getReleaseNotes(version: string): string | null {
	return RELEASE_NOTES[version] ?? null;
}

/**
 * Get the current release notes plus recent prior authored releases.
 */
export function getRecentReleaseNotes(currentVersion: string, count = 3): ReleaseNotesEntry[] {
	return Object.keys(RELEASE_NOTES)
		.filter(version => version === currentVersion || isVersionNewer(currentVersion, version))
		.sort((a, b) => {
			if (isVersionNewer(a, b)) return -1;
			if (isVersionNewer(b, a)) return 1;
			return 0;
		})
		.slice(0, count)
		.map(version => ({
			version,
			content: RELEASE_NOTES[version],
			isCurrent: version === currentVersion
		}));
}
