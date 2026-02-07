/**
 * Tests for version comparison utility
 */

import { isVersionNewer } from '../../src/utils/version';

describe('isVersionNewer', () => {
	it('should detect newer major version', () => {
		expect(isVersionNewer('2.0.0', '1.0.0')).toBe(true);
	});

	it('should detect newer minor version', () => {
		expect(isVersionNewer('1.2.0', '1.1.0')).toBe(true);
	});

	it('should detect newer patch version', () => {
		expect(isVersionNewer('1.1.1', '1.1.0')).toBe(true);
	});

	it('should return false for equal versions', () => {
		expect(isVersionNewer('1.1.0', '1.1.0')).toBe(false);
	});

	it('should return false for older major version', () => {
		expect(isVersionNewer('1.0.0', '2.0.0')).toBe(false);
	});

	it('should return false for older minor version', () => {
		expect(isVersionNewer('1.0.0', '1.1.0')).toBe(false);
	});

	it('should return false for older patch version', () => {
		expect(isVersionNewer('1.1.0', '1.1.1')).toBe(false);
	});

	it('should handle missing patch component', () => {
		expect(isVersionNewer('1.2', '1.1.0')).toBe(true);
		expect(isVersionNewer('1.1.0', '1.2')).toBe(false);
	});

	it('should handle major-only versions', () => {
		expect(isVersionNewer('2', '1')).toBe(true);
		expect(isVersionNewer('1', '2')).toBe(false);
	});

	it('should treat missing parts as zero', () => {
		expect(isVersionNewer('1.0.0', '1')).toBe(false);
		expect(isVersionNewer('1.0.1', '1')).toBe(true);
	});

	it('should handle large version numbers', () => {
		expect(isVersionNewer('10.20.30', '10.20.29')).toBe(true);
		expect(isVersionNewer('10.20.30', '10.20.30')).toBe(false);
	});
});
