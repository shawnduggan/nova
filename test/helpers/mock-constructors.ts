import { Editor, TFile } from 'obsidian';

type MockConstructor<T, Args extends unknown[]> = new (...args: Args) => T;

const MockEditor = Editor as unknown as MockConstructor<Editor, [content?: string]>;
const MockTFile = TFile as unknown as MockConstructor<TFile, [path?: string]>;

export function createMockEditor(content = ''): Editor {
	return new MockEditor(content);
}

export function createMockTFile(path = 'test.md'): TFile {
	return new MockTFile(path);
}
