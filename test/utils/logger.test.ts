/**
 * @file Logger privacy tests
 */

import { Logger, LogLevel } from '../../src/utils/logger';

describe('Logger privacy', () => {
	const originalNodeEnv = process.env.NODE_ENV;
	const originalLevel = Logger.currentLevel;

	afterEach(() => {
		process.env.NODE_ENV = originalNodeEnv;
		Logger.setLevel(originalLevel);
		jest.restoreAllMocks();
	});

	test('suppresses debug and info output in production even at debug level', () => {
		process.env.NODE_ENV = 'production';
		Logger.setLevel(LogLevel.DEBUG);
		const debug = jest.spyOn(console, 'debug').mockImplementation(() => undefined);

		Logger.debug('secret prompt', { apiKey: 'secret-key' });
		Logger.info('secret response', { content: 'private content' });

		expect(debug).not.toHaveBeenCalled();
	});

	test('drops production warning and error messages and arguments', () => {
		process.env.NODE_ENV = 'production';
		Logger.setLevel(LogLevel.DEBUG);
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

		Logger.warn('secret warning', { response: 'private response' });
		Logger.error('secret error', { headers: { authorization: 'secret-key' } });
		Logger.scope('Provider').error('secret endpoint', 'https://private.example');

		expect(warn).toHaveBeenCalledWith('[Nova] Warning');
		expect(error).toHaveBeenNthCalledWith(1, '[Nova] Error');
		expect(error).toHaveBeenNthCalledWith(2, '[Nova:Provider] Error');
		expect(JSON.stringify([...warn.mock.calls, ...error.mock.calls])).not.toContain('secret');
		expect(JSON.stringify([...warn.mock.calls, ...error.mock.calls])).not.toContain('private');
	});

	test('retains diagnostics in development', () => {
		process.env.NODE_ENV = 'development';
		Logger.setLevel(LogLevel.DEBUG);
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

		Logger.warn('Development warning', { status: 500 });

		expect(warn).toHaveBeenCalledWith('[Nova] Development warning', { status: 500 });
	});
});
