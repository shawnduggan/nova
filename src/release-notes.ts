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
	// Add entries before running `npm version`. The /release command handles this.
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
		'- **Supernova is Nova\'s premium feature tier.** Smart Revision is the first permanent Supernova feature, with more premium workflows planned.',
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
	'1.7.0': [
		'## What\'s New in Nova 1.7.0',
		'',
		'### OpenAI-Compatible Endpoints',
		'',
		'- **Connect Nova to OpenAI-compatible Chat Completions providers.** Use LM Studio, LocalAI, LiteLLM, OpenRouter, and other compatible gateways from the new provider settings.',
		'- **Model setup is easier.** Test connection refreshes `/models` and lets you select one model in settings; if `/models` is unavailable, Nova validates a manually entered model with a tiny completion.',
		'- **The sidebar stays focused.** OpenAI-compatible providers show only the selected model in the main model picker, so large catalogs do not flood the dropdown.',
		'- **Mobile handling is clearer.** Cloud-compatible endpoints can run on mobile, while localhost, private-network, `.local`, and single-hostname URLs remain desktop-only.',
		'',
		'### Polish',
		'',
		'- **Provider settings and sidebar layout are cleaner in Obsidian 1.13.** The settings cards, connection buttons, secure inputs, and sidebar model picker now keep their intended spacing in both the original and popout settings layouts.',
	].join('\n'),
	'1.6.3': [
		'## What\'s New in Nova 1.6.3',
		'',
		'### New Models',
		'',
		'- **Claude Opus 4.8 is available.** Anthropic\'s latest Opus model is now selectable in the Claude model picker with its 1M-token context window.',
		'- **Opus requests avoid deprecated sampling settings.** Nova omits `temperature` for Opus 4.8, matching Anthropic\'s Messages API requirements so requests complete instead of returning a parameter error.',
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
