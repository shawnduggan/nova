/**
 * @file OpenAICompatibleProvider - Chat Completions integration for OpenAI-compatible endpoints
 */

import { requestUrl } from 'obsidian';
import { AIProvider, AIMessage, AIGenerationOptions, AIStreamResponse, ProviderConfig } from '../types';
import { Logger } from '../../utils/logger';
import { TimeoutManager } from '../../utils/timeout-manager';

const RESOURCE_SUFFIX_PATTERN = /\/(?:chat\/completions|completions|models)$/i;

export function normalizeOpenAICompatibleBaseUrl(baseUrl?: string): string {
	const trimmedBaseUrl = baseUrl?.trim() || '';
	if (!trimmedBaseUrl) {
		return '';
	}

	const withoutTrailingSlashes = trimmedBaseUrl.replace(/\/+$/, '');
	return withoutTrailingSlashes.replace(RESOURCE_SUFFIX_PATTERN, '').replace(/\/+$/, '');
}

export function isLocalOpenAICompatibleBaseUrl(baseUrl?: string): boolean {
	const normalizedBaseUrl = normalizeOpenAICompatibleBaseUrl(baseUrl);
	if (!normalizedBaseUrl) {
		return false;
	}

	const parseTarget = /^[a-z][a-z\d+\-.]*:\/\//i.test(normalizedBaseUrl)
		? normalizedBaseUrl
		: `http://${normalizedBaseUrl}`;

	let url: URL;
	try {
		url = new URL(parseTarget);
	} catch {
		return true;
	}

	const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
	if (!hostname) {
		return true;
	}

	if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '::1') {
		return true;
	}

	if (hostname.endsWith('.local') || !hostname.includes('.')) {
		return true;
	}

	if (hostname.includes(':')) {
		return hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80:');
	}

	const octets = hostname.split('.').map(part => Number(part));
	if (octets.length !== 4 || octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
		return false;
	}

	const [first, second] = octets;
	return first === 10
		|| first === 127
		|| first === 0
		|| (first === 172 && second >= 16 && second <= 31)
		|| (first === 192 && second === 168);
}

export class OpenAICompatibleProvider implements AIProvider {
	name = 'OpenAI-compatible (LM Studio and others)';
	private config: ProviderConfig;
	private cachedModels: string[] | null = null;
	private generalSettings: { defaultTemperature: number; defaultMaxTokens: number };
	private timeoutManager: TimeoutManager;

	constructor(config: ProviderConfig, generalSettings: { defaultTemperature: number; defaultMaxTokens: number }, timeoutManager: TimeoutManager) {
		this.config = config;
		this.generalSettings = generalSettings;
		this.timeoutManager = timeoutManager;
	}

	updateConfig(config: ProviderConfig): void {
		this.config = config;
		this.cachedModels = null;
	}

	isAvailable(): boolean {
		const baseUrl = normalizeOpenAICompatibleBaseUrl(this.config.baseUrl);
		const savedModel = this.config.model?.trim();
		return !!baseUrl && !!savedModel;
	}

	async generateText(prompt: string, options?: AIGenerationOptions): Promise<string> {
		return this.chatCompletion([{ role: 'user', content: prompt }], options);
	}

	async *generateTextStream(prompt: string, options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		yield* this.chatCompletionStream([{ role: 'user', content: prompt }], options);
	}

	async chatCompletion(messages: AIMessage[], options?: AIGenerationOptions): Promise<string> {
		const baseUrl = normalizeOpenAICompatibleBaseUrl(this.config.baseUrl);
		if (!baseUrl) {
			throw new Error('OpenAI-compatible base URL not configured');
		}

		const modelName = options?.model || this.config.model;
		if (!modelName) {
			throw new Error('OpenAI-compatible model must be specified');
		}

		const requestMessages = [...messages];
		if (options?.systemPrompt) {
			requestMessages.unshift({ role: 'system', content: options.systemPrompt });
		}

		const endpoint = `${baseUrl}/chat/completions`;
		const requestBody = {
			model: modelName,
			messages: requestMessages,
			temperature: options?.temperature ?? this.generalSettings.defaultTemperature,
			max_tokens: options?.maxTokens ?? this.generalSettings.defaultMaxTokens,
			stream: false
		};

			const response = await requestUrl({
			url: endpoint,
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify(requestBody),
				throw: false
			}).catch(() => {
				throw new Error('OpenAI-compatible API request failed');
			});

			if (response.status !== 200) {
				Logger.error('OpenAI-compatible API request failed', {
					status: response.status,
					model: modelName
				});
				throw new Error(`OpenAI-compatible API error: ${response.status}`);
		}

		const content = this.extractChatCompletionText(response.json);
		if (!content) {
				Logger.error('OpenAI-compatible API response had an unexpected format', { model: modelName });
			throw new Error('OpenAI-compatible API: Unexpected response format');
		}

		return content;
	}

	async complete(systemPrompt: string, userPrompt: string, options?: AIGenerationOptions): Promise<string> {
		return this.chatCompletion([
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt }
		], options);
	}

	async *chatCompletionStream(messages: AIMessage[], options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		const result = await this.chatCompletion(messages, options);

		for (let index = 0; index < result.length; index += 3) {
			if (options?.signal?.aborted) {
				return;
			}

			yield { content: result.slice(index, index + 3), done: false };
			await new Promise<void>(resolve => {
				this.timeoutManager.addTimeout(() => resolve(), 20);
			});
		}

		yield { content: '', done: true };
	}

	async getAvailableModels(): Promise<string[]> {
		if (this.cachedModels) {
			return this.cachedModels;
		}

		const baseUrl = normalizeOpenAICompatibleBaseUrl(this.config.baseUrl);
		if (!baseUrl) {
			throw new Error('OpenAI-compatible base URL not configured');
		}

			const response = await requestUrl({
			url: `${baseUrl}/models`,
			method: 'GET',
			headers: this.getHeaders(),
				throw: false
			}).catch(() => {
				throw new Error('OpenAI-compatible models API request failed');
			});

			if (response.status !== 200) {
				throw new Error(`OpenAI-compatible models API error: ${response.status}`);
		}

		const models = this.extractModelNames(response.json);
		this.cachedModels = models;
		return models;
	}

	clearModelCache(): void {
		this.cachedModels = null;
	}

	private getHeaders(): Record<string, string> {
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		const apiKey = this.config.apiKey?.trim();
		if (apiKey) {
			headers.Authorization = `Bearer ${apiKey}`;
		}
		return headers;
	}

	private extractModelNames(responseJson: unknown): string[] {
		const candidates = this.getModelCandidates(responseJson);
		const names = candidates.flatMap(candidate => {
			if (typeof candidate === 'string') {
				const trimmed = candidate.trim();
				return trimmed ? [trimmed] : [];
			}

			if (!candidate || typeof candidate !== 'object') {
				return [];
			}

			const model = candidate as { id?: unknown; name?: unknown; model?: unknown };
			const name = model.id || model.name || model.model;
			if (typeof name !== 'string') {
				return [];
			}

			const trimmedName = name.trim();
			return trimmedName ? [trimmedName] : [];
		});

		return Array.from(new Set(names));
	}

	private getModelCandidates(responseJson: unknown): unknown[] {
		if (Array.isArray(responseJson)) {
			return responseJson;
		}

		if (!responseJson || typeof responseJson !== 'object') {
			return [];
		}

		const response = responseJson as { data?: unknown; models?: unknown };
		if (Array.isArray(response.data)) {
			return response.data;
		}
		if (Array.isArray(response.models)) {
			return response.models;
		}
		if (response.models && typeof response.models === 'object' && Array.isArray((response.models as { data?: unknown }).data)) {
			return (response.models as { data: unknown[] }).data;
		}

		return [];
	}

	private extractChatCompletionText(responseJson: unknown): string {
		if (!responseJson || typeof responseJson !== 'object') {
			return '';
		}

		const choices = (responseJson as { choices?: unknown }).choices;
		if (!Array.isArray(choices) || choices.length === 0) {
			return '';
		}

		const firstChoice = choices[0] as { message?: unknown; text?: unknown };
		if (firstChoice.message && typeof firstChoice.message === 'object') {
			const content = (firstChoice.message as { content?: unknown }).content;
			return this.extractTextContent(content);
		}

		return this.extractTextContent(firstChoice.text);
	}

	private extractTextContent(content: unknown): string {
		if (typeof content === 'string') {
			return content;
		}

		if (!Array.isArray(content)) {
			return '';
		}

		return content.map(part => {
			if (typeof part === 'string') {
				return part;
			}
			if (!part || typeof part !== 'object') {
				return '';
			}
			const contentPart = part as { text?: unknown; value?: unknown; content?: unknown };
			const value = contentPart.text || contentPart.value || contentPart.content;
			return typeof value === 'string' ? value : '';
		}).join('');
	}

}
