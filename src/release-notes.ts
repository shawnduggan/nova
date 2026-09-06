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
	'1.8.5': [
		"## What's New in Nova 1.8.5",
		"",
		"### Updated AI models",
		"",
		"- **Four new cloud models are available.** Choose Claude Fable 5.1, GPT-6 Astra, Gemini 3.8 Flash, or Gemini 3.5 Flash-Lite using your own provider account.",
		"- **The model picker is easier to scan.** Models are grouped by capability tier, with Fable and Astra first in their providers. Superseded choices leave the main list, while your existing saved selection remains available.",
		"",
		"### Reliability",
		"",
		"- **Claude failures are clearer.** Nova reports refusals and exhausted response limits instead of treating incomplete text as a finished answer.",
		"- **Claude connection checks stay lightweight.** Nova checks credentials with Haiku; access to your selected model is checked when you use it.",
		"",
		"### Provider privacy",
		"",
		"- **Check Fable's retention requirements before use.** [Claude Fable 5.1 requires 30-day provider retention](https://platform.claude.com/docs/en/models/fable-5-1/overview); zero data retention requires Anthropic authorization. Nova continues to send requests directly to your chosen provider and collects no plugin telemetry.",
	].join('\n'),
	'1.8.4': [
		'## What\'s New in Nova 1.8.4',
		'',
		'### Reliability',
		'',
		'- **AI provider responses fail safely.** Nova now validates malformed or incomplete responses from OpenAI, Google, and Ollama, returning clear errors instead of relying on unexpected provider data.',
		'- **Saved conversations recover cleanly.** Nova discards malformed persisted messages while preserving valid history and supported message details.',
		'- **Credential and settings saves are more resilient.** Nova can securely migrate credentials when older settings are incomplete, and each save uses one consistent snapshot while credentials are being encrypted.',
		'',
		'### Obsidian compatibility',
		'',
		'- **Nova uses current public APIs across supported versions.** Thinking notices, editing notices, sidebar elements, and dashboard sparklines now follow current Obsidian patterns while retaining compatibility with older supported releases.',
	].join('\n'),
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
