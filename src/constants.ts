/**
 * @file Constants - Shared constants and magic strings
 */

export const NOVA_CONVERSATIONS_STORAGE_KEY = 'nova-conversations';
export const NOVA_API_KEYS_SALT = 'nova-api-keys-salt';
export const VIEW_TYPE_NOVA_SIDEBAR = 'nova-sidebar';
export const VIEW_TYPE_PROSE_LINTER = 'nova-prose-linter';
export const NOVA_STAR_ICON = 'nova-star';
export const NOVA_SUPERNOVA_ICON = 'nova-supernova';
export const FEATURE_SMARTFILL = 'smartfill';
export const FEATURE_SMART_REVISION = 'smart-revision';
export const NOVA_PROVIDER_CONFIGURED_EVENT = 'nova-provider-configured';
export const NOVA_PROVIDER_DISCONNECTED_EVENT = 'nova-provider-disconnected';
export const NOVA_LICENSE_UPDATED_EVENT = 'nova-license-updated';
export const NOVA_WRITING_ANALYSIS_UPDATED_EVENT = 'nova-writing-analysis-updated';
export const NOVA_INDICATOR_CLICK_EVENT = 'nova-indicator-click';

export const PROVIDER_CLAUDE = 'claude';
export const PROVIDER_OPENAI = 'openai';
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_OLLAMA = 'ollama';

export const CHATGPT_ALIAS = 'chatgpt';
export const GEMINI_ALIAS = 'gemini';

export const CUSTOM_PROMPT_HISTORY_MAX = 5;

export const KOFI_URL = 'https://ko-fi.com/shawnduggan';
export const SUPERNOVA_PLANS_URL = 'https://novawriter.ai/plans';

export const CHALLENGE_SYSTEM_PROMPT = `You are a critical editor reviewing the selected text. Your job is NOT to improve the writing — it's to challenge the thinking.

Identify:
- Claims made without evidence or support
- Logical gaps or jumps in reasoning
- Assumptions that may not be shared by the reader
- Counter-arguments the author hasn't addressed
- Questions a skeptical reader would ask

Be direct and specific. Reference exact phrases from the text. Don't suggest rewrites — identify what needs the author's attention.

Keep your response concise — focus on the 2-3 most significant issues, not an exhaustive list.`;
