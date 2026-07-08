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
	'1.8.0': [
		'## What\'s New in Nova 1.8.0',
		'',
		'### Supernova model update',
		'',
		'- **Nova\'s free core stays free.** Selection editing, cursor chat, auto-context, Smart Fill, Writing Analysis, Writing Dashboard, Prose Linter, and all supported providers remain available without a Supernova license.',
		'- **Supernova now unlocks advanced AI revision workflows.** Smart Revision is the first permanent Supernova feature, with Voice Match planned next.',
		'- **Lifetime is now the lead Supernova offer.** $79 lifetime unlocks Supernova features in Nova; $29/year remains available for users who prefer annual support.',
		'- **Existing licenses carry forward.** Annual, lifetime, and founding Supernova licenses unlock the new revision tier.',
		'',
		'### Smart Revision',
		'',
		'- **Claude Sonnet 5 is available.** Anthropic\'s new Sonnet model is now selectable in the Claude model picker with its 1M-token context window.',
		'- **Model pickers are current.** OpenAI now shows GPT-5.5 and GPT-5.4 family models, and Gemini adds Gemini 3.5 Flash plus stable Gemini 3.1 Flash-Lite while dropping the shut-down Flash-Lite preview.',
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
	'1.6.2': [
		'## What\'s New in Nova 1.6.2',
		'',
		'### Prose Linter Polish',
		'',
		'- **Ignored issues now persist per note.** Use Ignore to hide a specific issue in the current note, then restore it later from the ignored-items section when you want it back.',
		'- **Repeated phrase review is clearer.** Jump and editor highlights now account for related nearby phrase occurrences, making echoes easier to spot and revise.',
		'- **Weakener guidance is more practical.** Nova now focuses the suggestion on removing the weakener or choosing more exact wording instead of implying an AI rewrite.',
		'',
		'### Thanks',
		'',
		'Thanks to Helmut for the thoughtful suggestions!',
	].join('\n'),
	'1.6.1': [
		'## What\'s New in Nova 1.6.1',
		'',
		'### Ollama Improvements',
		'',
		'- **Ollama models now appear in the main model picker.** Testing your Ollama connection refreshes Nova\'s local model list, so configured Ollama models are available from the sidebar picker.',
		'- **Ollama settings are clearer.** The settings panel now explains that adding or removing local Ollama models requires testing the connection again to refresh the picker.',
		'- **Existing Ollama setups keep working.** Nova preserves your saved Ollama model during migration, even before the refreshed local model list is available.',
		'',
		'### Bug Fixes',
		'',
		'- **Reflective questions no longer trigger edit mode.** Messages like "I wish I knew..." now route to chat instead of being misread as edit requests.',
		'- **Long notes no longer hit an obsolete prompt-length guard.** Nova removed the old 10,000-character generated-prompt limit that could block short requests when the active note was large.',
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
