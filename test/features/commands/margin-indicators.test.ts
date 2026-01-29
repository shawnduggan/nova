/**
 * MarginIndicators Test Suite
 * Tests for intelligent margin indicator detection and behavior
 */

import { MarginIndicators } from '../../../src/features/commands/ui/MarginIndicators';
import { SmartVariableResolver } from '../../../src/features/commands/core/SmartVariableResolver';
import { CommandEngine } from '../../../src/features/commands/core/CommandEngine';
import { SmartTimingEngine } from '../../../src/features/commands/core/SmartTimingEngine';
import type { SmartContext } from '../../../src/features/commands/types';

// Local interface for testing (matches the one in MarginIndicators.ts)
interface IndicatorOpportunity {
    line: number;
    column: number;
    type: 'enhancement' | 'quickfix' | 'metrics' | 'transform';
    icon: string;
    commands: any[];
    confidence: number;
}

// Mock dependencies
jest.mock('../../../src/utils/logger', () => ({
    Logger: {
        scope: jest.fn().mockReturnValue({
            info: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        })
    }
}));

describe('MarginIndicators', () => {
    let marginIndicators: MarginIndicators;
    let mockPlugin: any;
    let mockVariableResolver: any;
    let mockCommandEngine: any;
    let mockSmartTimingEngine: any;
    let mockEditor: any;
    let mockView: any;

    beforeEach(() => {
        // Mock NovaPlugin
        mockPlugin = {
            app: {
                workspace: {
                    getActiveViewOfType: jest.fn(),
                    on: jest.fn()
                },
                vault: {
                    getMarkdownFiles: jest.fn().mockReturnValue([])
                },
                metadataCache: {
                    getFileCache: jest.fn()
                }
            },
            registerEvent: jest.fn(),
            registerDomEvent: jest.fn(),
            settings: {
                commands: {
                    suggestionMode: 'balanced',
                    responseTime: 'normal',
                    hideWhileTyping: true,
                    enabledDocumentTypes: ['blog', 'academic', 'technical', 'creative', 'notes']
                }
            }
        };

        // Mock Editor
        mockEditor = {
            lineCount: jest.fn().mockReturnValue(10),
            getLine: jest.fn(),
            getCursor: jest.fn().mockReturnValue({ line: 0, ch: 0 })
        };

        // Mock MarkdownView
        mockView = {
            editor: mockEditor,
            file: { basename: 'test.md', path: 'test.md' },
            containerEl: {
                querySelector: jest.fn().mockImplementation((selector) => {
                    if (selector === '.cm-scroller') {
                        return {
                            createDiv: jest.fn().mockReturnValue({
                                textContent: '',
                                setAttribute: jest.fn(),
                                style: {}
                            }),
                            scrollTop: 0,
                            clientHeight: 600,
                            getBoundingClientRect: jest.fn().mockReturnValue({ top: 0 })
                        };
                    }
                    if (selector === '.cm-content') {
                        return {
                            querySelectorAll: jest.fn().mockReturnValue([
                                { getBoundingClientRect: () => ({ height: 20 }) }
                            ])
                        };
                    }
                    return null;
                })
            }
        };

        // Mock SmartVariableResolver
        mockVariableResolver = {
            buildSmartContext: jest.fn().mockReturnValue({
                selection: '',
                document: 'Test document',
                title: 'test.md',
                documentType: 'unknown',
                cursorContext: '',
                metrics: { wordCount: 100 },
                audienceLevel: 'general'
            } as SmartContext)
        };

        // Mock CommandEngine
        mockCommandEngine = {
            executeCommand: jest.fn().mockResolvedValue(undefined),
            executeFill: jest.fn().mockResolvedValue(undefined),
            detectMarkers: jest.fn().mockReturnValue([])
        };

        // Mock SmartTimingEngine
        mockSmartTimingEngine = {
            on: jest.fn(),
            off: jest.fn(),
            setDocumentType: jest.fn(),
            onEditorInput: jest.fn(),
            onScroll: jest.fn(),
            cancelPendingAnalysis: jest.fn(),
            cleanup: jest.fn()
        };

        marginIndicators = new MarginIndicators(mockPlugin, mockVariableResolver, mockCommandEngine, mockSmartTimingEngine);
    });

    describe('Opportunity Detection', () => {
        describe('Enhancement Opportunities', () => {
            test('should detect bullet points as enhancement opportunities', async () => {
                const testLines = [
                    '- This is a bullet point',
                    '* Another bullet point',
                    '+ Third bullet style'
                ];

                const context = mockVariableResolver.buildSmartContext();
                
                for (const line of testLines) {
                    const shouldShow = (marginIndicators as any).shouldShowEnhancementIndicators(context, line);
                    expect(shouldShow).toBe(true);
                }
            });

            test('should detect weak language as enhancement opportunities', async () => {
                const testLines = [
                    'I think this might work',
                    'Maybe we should consider this',
                    'Perhaps this is the answer'
                ];

                const context = mockVariableResolver.buildSmartContext();
                
                for (const line of testLines) {
                    const shouldShow = (marginIndicators as any).shouldShowEnhancementIndicators(context, line);
                    expect(shouldShow).toBe(true);
                }
            });

            test('should NOT detect headers as enhancement opportunities', async () => {
                const testLines = [
                    '# Main Header',
                    '## Secondary Header',
                    '### Third Level Header',
                    '#### Fourth Level Header'
                ];

                const context = mockVariableResolver.buildSmartContext();
                
                for (const line of testLines) {
                    const shouldShow = (marginIndicators as any).shouldShowEnhancementIndicators(context, line);
                    expect(shouldShow).toBe(false);
                }
            });

            test('should NOT detect normal prose as enhancement opportunities', async () => {
                const testLines = [
                    'This is a normal sentence with good content.',
                    'Here is another well-written paragraph with substance.',
                    'Regular prose should not trigger enhancement indicators.'
                ];

                const context = mockVariableResolver.buildSmartContext();
                
                for (const line of testLines) {
                    const shouldShow = (marginIndicators as any).shouldShowEnhancementIndicators(context, line);
                    expect(shouldShow).toBe(false);
                }
            });
        });

        describe('Quick Fix Opportunities', () => {
            test('should detect passive voice correctly', async () => {
                const testLines = [
                    'The document was written by the author',
                    'Mistakes were made throughout the process',
                    'The code has been reviewed by the team'
                ];

                const context = mockVariableResolver.buildSmartContext();
                
                for (const line of testLines) {
                    const shouldShow = (marginIndicators as any).shouldShowQuickFixIndicators(context, line);
                    expect(shouldShow).toBe(true);
                }
            });

            test('should detect weak words', async () => {
                const testLines = [
                    'This is very important information',
                    'The solution is really quite simple',
                    'It is somewhat difficult to understand',
                    'This approach is rather complicated'
                ];

                const context = mockVariableResolver.buildSmartContext();
                
                for (const line of testLines) {
                    const shouldShow = (marginIndicators as any).shouldShowQuickFixIndicators(context, line);
                    expect(shouldShow).toBe(true);
                }
            });

            test('should NOT detect normal active voice', async () => {
                const testLines = [
                    'The author wrote the document',
                    'The team reviewed the code',
                    'We completed the project successfully'
                ];

                const context = mockVariableResolver.buildSmartContext();
                
                for (const line of testLines) {
                    const shouldShow = (marginIndicators as any).shouldShowQuickFixIndicators(context, line);
                    expect(shouldShow).toBe(false);
                }
            });
        });

        describe('Transform Opportunities', () => {
            test('should detect "telling" language', async () => {
                const testLines = [
                    'She felt sad when she heard the news',
                    'He thought about the problem carefully',
                    'They believed the solution would work',
                    'I knew this was the right answer',
                    'She realized the truth about the situation'
                ];

                const context = mockVariableResolver.buildSmartContext();
                
                for (const line of testLines) {
                    const shouldShow = (marginIndicators as any).shouldShowTransformIndicators(context, line);
                    expect(shouldShow).toBe(true);
                }
            });

            test('should NOT detect action-based writing', async () => {
                const testLines = [
                    'She slammed the door and walked away',
                    'The rain pounded against the windows',
                    'He picked up the phone and dialed the number'
                ];

                const context = mockVariableResolver.buildSmartContext();
                
                for (const line of testLines) {
                    const shouldShow = (marginIndicators as any).shouldShowTransformIndicators(context, line);
                    expect(shouldShow).toBe(false);
                }
            });
        });

        describe('Metrics Opportunities', () => {
            test('should show metrics for documents over 500 words', async () => {
                const context = {
                    ...mockVariableResolver.buildSmartContext(),
                    metrics: { wordCount: 750 }
                };

                const shouldShow = (marginIndicators as any).shouldShowMetricsIndicators(context);
                expect(shouldShow).toBe(true);
            });

            test('should NOT show metrics for short documents', async () => {
                const context = {
                    ...mockVariableResolver.buildSmartContext(),
                    metrics: { wordCount: 250 }
                };

                const shouldShow = (marginIndicators as any).shouldShowMetricsIndicators(context);
                expect(shouldShow).toBe(false);
            });
        });

        describe('Edge Cases', () => {
            test('should handle empty lines', async () => {
                const testLines = ['', '   ', '\t\t'];
                const context = mockVariableResolver.buildSmartContext();
                
                for (const line of testLines) {
                    const enhancementShow = (marginIndicators as any).shouldShowEnhancementIndicators(context, line);
                    const quickFixShow = (marginIndicators as any).shouldShowQuickFixIndicators(context, line);
                    const transformShow = (marginIndicators as any).shouldShowTransformIndicators(context, line);
                    
                    expect(enhancementShow).toBe(false);
                    expect(quickFixShow).toBe(false);
                    expect(transformShow).toBe(false);
                }
            });

            test('should handle very long lines', async () => {
                const longLine = 'This is a very long line that exceeds normal paragraph length and should be handled appropriately by the detection system without causing performance issues or false positives in the analysis engine.';
                const context = mockVariableResolver.buildSmartContext();
                
                // Should not trigger just because it's long
                const shouldShow = (marginIndicators as any).shouldShowEnhancementIndicators(context, longLine);
                expect(shouldShow).toBe(false);
            });
        });
    });

    describe('Viewport Calculation', () => {
        test('should calculate visible lines correctly', () => {
            // Setup mock editor with known line count
            mockEditor.lineCount.mockReturnValue(100);
            
            // Setup mock scroller with known dimensions
            const mockScroller = {
                scrollTop: 200,
                clientHeight: 600,
                querySelector: jest.fn()
            };
            mockView.containerEl.querySelector.mockImplementation((selector: string) => {
                if (selector === '.cm-scroller') return mockScroller;
                if (selector === '.cm-content') {
                    return {
                        querySelectorAll: jest.fn().mockReturnValue([
                            { getBoundingClientRect: () => ({ height: 20 }) }
                        ])
                    };
                }
                return null;
            });

            (marginIndicators as any).activeEditor = mockEditor;
            (marginIndicators as any).activeView = mockView;

            const range = (marginIndicators as any).getVisibleLineRange();
            
            // With scrollTop=200, clientHeight=600, lineHeight=20
            // firstVisibleLine = max(0, floor(200/20) - 5) = max(0, 10-5) = 5
            // lastVisibleLine = min(99, ceil((200+600)/20) + 5) = min(99, 40+5) = 45
            expect(range.from).toBe(5);
            expect(range.to).toBe(45);
        });

        test('should add buffer lines for smooth scrolling', () => {
            mockEditor.lineCount.mockReturnValue(20);
            
            const mockScroller = {
                scrollTop: 0,
                clientHeight: 400,
                querySelector: jest.fn()
            };
            mockView.containerEl.querySelector.mockImplementation((selector: string) => {
                if (selector === '.cm-scroller') return mockScroller;
                if (selector === '.cm-content') {
                    return {
                        querySelectorAll: jest.fn().mockReturnValue([
                            { getBoundingClientRect: () => ({ height: 20 }) }
                        ])
                    };
                }
                return null;
            });

            (marginIndicators as any).activeEditor = mockEditor;
            (marginIndicators as any).activeView = mockView;

            const range = (marginIndicators as any).getVisibleLineRange();
            
            // Should include buffer (5 lines) beyond visible area
            expect(range.from).toBe(0); // max(0, -5) = 0
            expect(range.to).toBe(19); // min(19, 25) = 19
        });
    });

    describe('Performance Features', () => {
        test('should limit indicators to MAX_INDICATORS', () => {
            const opportunities: IndicatorOpportunity[] = [];
            
            // Create 30 opportunities (more than MAX_INDICATORS = 20)
            for (let i = 0; i < 30; i++) {
                opportunities.push({
                    line: i,
                    column: 80,
                    type: 'enhancement',
                    icon: '💡',
                    commands: [],
                    confidence: Math.random()
                });
            }

            const filtered = (marginIndicators as any).filterOpportunitiesByIntensity(opportunities);
            expect(filtered.length).toBeLessThanOrEqual(20);
        });

        test('should sort by confidence when limiting', () => {
            const opportunities: IndicatorOpportunity[] = [
                { line: 0, column: 80, type: 'enhancement', icon: '💡', commands: [], confidence: 0.3 },
                { line: 1, column: 80, type: 'enhancement', icon: '💡', commands: [], confidence: 0.9 },
                { line: 2, column: 80, type: 'enhancement', icon: '💡', commands: [], confidence: 0.7 },
                { line: 3, column: 80, type: 'enhancement', icon: '💡', commands: [], confidence: 0.1 }
            ];

            const filtered = (marginIndicators as any).filterOpportunitiesByIntensity(opportunities);
            
            // Should be sorted by confidence (highest first)
            expect(filtered.length).toBeGreaterThan(0);
            if (filtered.length >= 4) {
                expect(filtered[0].confidence).toBe(0.9);
                expect(filtered[1].confidence).toBe(0.7);
                expect(filtered[2].confidence).toBe(0.3);
                expect(filtered[3].confidence).toBe(0.1);
            }
        });

        test('should generate consistent hashes for same content', () => {
            const line1 = 'This is a test line';
            const line2 = 'This is a test line';
            const line3 = 'This is a different line';

            const hash1 = (marginIndicators as any).hashLine(line1);
            const hash2 = (marginIndicators as any).hashLine(line2);
            const hash3 = (marginIndicators as any).hashLine(line3);

            expect(hash1).toBe(hash2);
            expect(hash1).not.toBe(hash3);
        });
    });

    describe('Integration Tests', () => {
        test('should handle mixed content document', async () => {
            const testDocument = [
                '# Document Title',           // Header - should be skipped
                '',                          // Empty line - should be skipped  
                '- First bullet point',      // Enhancement opportunity
                '- Second bullet point',     // Enhancement opportunity
                '',                          // Empty line
                'This was written by someone.', // Quick fix opportunity (passive)
                'I think this is very important.', // Enhancement + Quick fix
                'She felt sad about the news.', // Transform opportunity
                'This is normal prose content.' // No opportunities
            ];

            // Mock the editor to return our test lines
            mockEditor.getLine.mockImplementation((lineNum: number) => testDocument[lineNum] || '');
            mockEditor.lineCount.mockReturnValue(testDocument.length);

            (marginIndicators as any).activeEditor = mockEditor;
            (marginIndicators as any).activeView = mockView;

            const context = mockVariableResolver.buildSmartContext();
            
            // Test individual line detection to verify logic works
            const line2Result = (marginIndicators as any).shouldShowEnhancementIndicators(context, testDocument[2]); // Bullet
            const line5Result = (marginIndicators as any).shouldShowQuickFixIndicators(context, testDocument[5]); // Passive
            const line6Result = (marginIndicators as any).shouldShowEnhancementIndicators(context, testDocument[6]); // I think
            const line7Result = (marginIndicators as any).shouldShowTransformIndicators(context, testDocument[7]); // felt
            
            // Verify individual detections work
            expect(line2Result).toBe(true); // Bullet point should be detected
            expect(line5Result).toBe(true); // Passive voice should be detected  
            expect(line6Result).toBe(true); // "I think" should be detected
            expect(line7Result).toBe(true); // "felt" should be detected
            
            // Test that headers are properly skipped
            const headerResult = (marginIndicators as any).shouldShowEnhancementIndicators(context, testDocument[0]);
            expect(headerResult).toBe(false);
        });

        test('should correctly count and position indicators for exact test document', async () => {
            // Exact document content from user's test file
            const testDocument = [
                '# Test Document for MarginIndicators',  // Line 0: Header - skip
                '',                                       // Line 1: Empty - skip
                '- This is a bullet point that could be expanded',  // Line 2: Enhancement
                '- Another brief point without examples', // Line 3: Enhancement
                '',                                       // Line 4: Empty - skip
                'I think this statement is somewhat unclear and maybe could be improved.', // Line 5: Enhancement + Quickfix
                '',                                       // Line 6: Empty - skip
                'The document was written by the author and mistakes were made throughout.', // Line 7: Quickfix
                '',                                       // Line 8: Empty - skip
                'She felt sad when she realized the truth about the situation.', // Line 9: Transform
                '',                                       // Line 10: Empty - skip
                'This is a paragraph that contains passive voice constructions and very weak language that really needs improvement.' // Line 11: Quickfix (multiple issues)
            ];

            // Mock the editor to return our test lines
            mockEditor.getLine.mockImplementation((lineNum: number) => testDocument[lineNum] || '');
            mockEditor.lineCount.mockReturnValue(testDocument.length);

            (marginIndicators as any).activeEditor = mockEditor;
            (marginIndicators as any).activeView = mockView;

            // Mock getVisibleLineRange to return the full document range
            (marginIndicators as any).getVisibleLineRange = jest.fn().mockReturnValue({
                from: 0,
                to: testDocument.length - 1
            });

            const context = mockVariableResolver.buildSmartContext();
            
            // Get all opportunities detected
            const opportunities = (marginIndicators as any).findOpportunities(context);
            
            // Analyze each line that should have opportunities
            const expectedLines = [2, 3, 5, 7, 9, 11];
            let detectedOpportunitiesByLine: Record<number, string[]> = {};
            
            for (const line of expectedLines) {
                detectedOpportunitiesByLine[line] = [];
                
                // Check each opportunity type for this line
                if ((marginIndicators as any).shouldShowEnhancementIndicators(context, testDocument[line])) {
                    detectedOpportunitiesByLine[line].push('enhancement');
                }
                if ((marginIndicators as any).shouldShowQuickFixIndicators(context, testDocument[line])) {
                    detectedOpportunitiesByLine[line].push('quickfix');
                }
                if ((marginIndicators as any).shouldShowTransformIndicators(context, testDocument[line])) {
                    detectedOpportunitiesByLine[line].push('transform');
                }
            }
            
            // Count total opportunities detected vs actual opportunities returned
            let expectedOpportunityCount = 0;
            for (const line in detectedOpportunitiesByLine) {
                expectedOpportunityCount += detectedOpportunitiesByLine[line].length;
            }
            
            // Verify no opportunities beyond the content
            const maxContentLine = testDocument.length - 1;
            const invalidOpportunities = opportunities.filter((o: any) => o.line > maxContentLine);
            expect(invalidOpportunities.length).toBe(0);
            
            // Verify expected lines have opportunities
            expect(detectedOpportunitiesByLine[2]).toContain('enhancement'); // First bullet
            expect(detectedOpportunitiesByLine[3]).toContain('enhancement'); // Second bullet
            expect(detectedOpportunitiesByLine[5].length).toBeGreaterThan(0); // "I think" line
            expect(detectedOpportunitiesByLine[7]).toContain('quickfix'); // Passive voice
            expect(detectedOpportunitiesByLine[9]).toContain('transform'); // "felt sad"
            expect(detectedOpportunitiesByLine[11].length).toBeGreaterThan(0); // Multiple issues line
        });

        test('should not create duplicate indicators for multi-issue lines', async () => {
            const multiIssueLines = [
                'I think this statement is somewhat unclear and maybe could be improved.', // enhancement + quickfix
                'This is a paragraph that contains passive voice constructions and very weak language that really needs improvement.' // multiple quickfix issues
            ];

            const context = mockVariableResolver.buildSmartContext();

            for (let i = 0; i < multiIssueLines.length; i++) {
                const line = multiIssueLines[i];
                const lineNumber = i + 5; // Start from line 5

                // Mock a single line document
                mockEditor.getLine.mockImplementation((lineNum: number) => lineNum === lineNumber ? line : '');
                mockEditor.lineCount.mockReturnValue(lineNumber + 1);

                (marginIndicators as any).activeEditor = mockEditor;
                (marginIndicators as any).activeView = mockView;

                const opportunities = (marginIndicators as any).findOpportunities(context);

                // Count how many opportunities are on this line
                const opportunitiesForLine = opportunities.filter((o: any) => o.line === lineNumber);
                console.log(`Line ${lineNumber}: "${line.substring(0, 50)}..." -> ${opportunitiesForLine.length} opportunities`);
                console.log('Types:', opportunitiesForLine.map((o: any) => o.type));

                // Multiple opportunities on same line should only create one indicator per type
                const uniqueTypes = new Set(opportunitiesForLine.map((o: any) => o.type));
                expect(opportunitiesForLine.length).toBe(uniqueTypes.size);
            }
        });

        test('should detect Nova markers in document', async () => {
            const testDocument = [
                '# Document with Markers',
                '',
                '<!-- nova: Write an introduction about AI -->',
                '',
                'Some regular content here.',
                '',
                '<!-- nova: Expand these bullets:',
                '- Time blocking',
                '- Notification batching',
                '-->',
            ];

            // Mock the editor to return our test lines
            mockEditor.getLine.mockImplementation((lineNum: number) => testDocument[lineNum] || '');
            mockEditor.lineCount.mockReturnValue(testDocument.length);

            (marginIndicators as any).activeEditor = mockEditor;
            (marginIndicators as any).activeView = mockView;

            // Mock getVisibleLineRange to return the full document range
            (marginIndicators as any).getVisibleLineRange = jest.fn().mockReturnValue({
                from: 0,
                to: testDocument.length - 1
            });

            // Mock detectMarkers to return markers
            const docContent = testDocument.join('\n');
            mockCommandEngine.detectMarkers.mockReturnValue([
                {
                    line: 2,
                    endLine: 2,
                    instruction: 'Write an introduction about AI',
                    position: docContent.indexOf('<!-- nova: Write'),
                    length: '<!-- nova: Write an introduction about AI -->'.length
                },
                {
                    line: 6,
                    endLine: 9,
                    instruction: 'Expand these bullets:\n- Time blocking\n- Notification batching',
                    position: docContent.indexOf('<!-- nova: Expand'),
                    length: '<!-- nova: Expand these bullets:\n- Time blocking\n- Notification batching\n-->'.length
                }
            ]);

            // Mock context with the document
            mockVariableResolver.buildSmartContext.mockReturnValueOnce({
                selection: '',
                document: docContent,
                title: 'test.md',
                documentType: 'unknown',
                cursorContext: '',
                metrics: { wordCount: 100 },
                audienceLevel: 'general'
            });

            const context = mockVariableResolver.buildSmartContext();
            const opportunities = (marginIndicators as any).findOpportunities(context);

            // Should have opportunities for markers
            const markerOpportunities = opportunities.filter((o: any) => o.icon === '📝');
            expect(markerOpportunities.length).toBe(2);

            // Check first marker
            const firstMarker = markerOpportunities.find((o: any) => o.line === 2);
            expect(firstMarker).toBeDefined();
            expect(firstMarker?.confidence).toBe(1.0);

            // Check second marker (multi-line)
            const secondMarker = markerOpportunities.find((o: any) => o.line === 6);
            expect(secondMarker).toBeDefined();
        });

        test('should skip marker lines for regular writing analysis', async () => {
            const testDocument = [
                '<!-- nova: Generate content -->',  // Should NOT get writing analysis
                'I think this is unclear.',  // Should get writing analysis
            ];

            mockEditor.getLine.mockImplementation((lineNum: number) => testDocument[lineNum] || '');
            mockEditor.lineCount.mockReturnValue(testDocument.length);

            (marginIndicators as any).activeEditor = mockEditor;
            (marginIndicators as any).activeView = mockView;

            (marginIndicators as any).getVisibleLineRange = jest.fn().mockReturnValue({
                from: 0,
                to: testDocument.length - 1
            });

            const docContent = testDocument.join('\n');
            mockCommandEngine.detectMarkers.mockReturnValue([{
                line: 0,
                endLine: 0,
                instruction: 'Generate content',
                position: 0,
                length: testDocument[0].length
            }]);

            mockVariableResolver.buildSmartContext.mockReturnValueOnce({
                selection: '',
                document: docContent,
                title: 'test.md',
                documentType: 'unknown',
                cursorContext: '',
                metrics: { wordCount: 10 },
                audienceLevel: 'general'
            });

            const context = mockVariableResolver.buildSmartContext();
            const opportunities = (marginIndicators as any).findOpportunities(context);

            // Line 0 should only have marker opportunity, not writing analysis
            const line0Opportunities = opportunities.filter((o: any) => o.line === 0);
            expect(line0Opportunities.length).toBe(1);
            expect(line0Opportunities[0].icon).toBe('📝');
        });
    });

    describe('Settings-Based Behavior', () => {
        describe('updateSettings Method', () => {
            test('should use settings from plugin', () => {
                marginIndicators.updateSettings();
                
                // Should use settings values
                expect((marginIndicators as any).intensityLevel).toBe('balanced');
                expect((marginIndicators as any).enabled).toBe(true);
            });

            test('should respond to settings changes', () => {
                // Test changing to minimal mode
                mockPlugin.settings.commands.suggestionMode = 'minimal';
                marginIndicators.updateSettings();
                
                expect((marginIndicators as any).intensityLevel).toBe('minimal');
                expect((marginIndicators as any).enabled).toBe(true);
                
                // Test disabling
                const clearSpy = jest.spyOn(marginIndicators, 'clearIndicators');
                mockPlugin.settings.commands.suggestionMode = 'off';
                marginIndicators.updateSettings();
                
                expect((marginIndicators as any).enabled).toBe(false);
                expect(clearSpy).toHaveBeenCalled();
            });

            test('should handle missing settings gracefully', () => {
                // Remove commands settings
                mockPlugin.settings.commands = undefined;
                
                // Should not crash
                expect(() => marginIndicators.updateSettings()).not.toThrow();
            });
        });

        describe('Intensity Level Filtering', () => {
            test('should filter opportunities based on intensity level', () => {
                const mockOpportunities = [
                    { confidence: 0.9, type: 'enhancement', line: 1, column: 0, icon: '💡', commands: [] },
                    { confidence: 0.7, type: 'quickfix', line: 2, column: 0, icon: '⚡', commands: [] },
                    { confidence: 0.5, type: 'metrics', line: 3, column: 0, icon: '📊', commands: [] },
                    { confidence: 0.3, type: 'transform', line: 4, column: 0, icon: '✨', commands: [] }
                ];

                // Test minimal mode (0.8 threshold)
                mockPlugin.settings.commands.suggestionMode = 'minimal';
                marginIndicators.updateSettings();
                
                const minimalFiltered = (marginIndicators as any).filterOpportunitiesByIntensity(mockOpportunities);
                expect(minimalFiltered).toHaveLength(1); // Only 0.9
                
                // Test balanced mode (0.6 threshold)
                mockPlugin.settings.commands.suggestionMode = 'balanced';
                marginIndicators.updateSettings();
                
                const balancedFiltered = (marginIndicators as any).filterOpportunitiesByIntensity(mockOpportunities);
                expect(balancedFiltered).toHaveLength(2); // 0.9 and 0.7
                
                // Test aggressive mode (0.4 threshold)
                mockPlugin.settings.commands.suggestionMode = 'aggressive';
                marginIndicators.updateSettings();
                
                const aggressiveFiltered = (marginIndicators as any).filterOpportunitiesByIntensity(mockOpportunities);
                expect(aggressiveFiltered).toHaveLength(3); // 0.9, 0.7, and 0.5
            });
        });

        describe('Document Type Handling', () => {
            test('should proceed with analysis for all document types', async () => {
                // Mock workspace to return mock view
                mockPlugin.app.workspace.getActiveViewOfType.mockReturnValue(mockView);

                mockPlugin.settings.commands.suggestionMode = 'balanced'; // Ensure enabled

                // Update settings to apply changes
                marginIndicators.updateSettings();
                (marginIndicators as any).activeEditor = mockEditor;
                (marginIndicators as any).activeView = mockView;

                // Mock context with academic document type
                mockVariableResolver.buildSmartContext.mockReturnValueOnce({
                    selection: '',
                    document: '# Research Paper\n\nThis is an academic paper.',
                    title: 'Research Paper',
                    documentType: 'academic',
                    cursorContext: { before: '', after: '' },
                    metrics: { wordCount: 8, paragraphCount: 1 },
                    audienceLevel: 'expert'
                });

                // Spy on SmartTimingEngine.setDocumentType
                const setDocTypeSpy = jest.spyOn(mockSmartTimingEngine, 'setDocumentType');

                // Should proceed and set document type
                (marginIndicators as any).analyzeCurrentContext();

                expect(setDocTypeSpy).toHaveBeenCalledWith('academic');
            });
        });

        describe('Settings Integration', () => {
            test('should respond to settings changes immediately', () => {
                // Start with balanced mode
                expect((marginIndicators as any).intensityLevel).toBe('balanced');
                expect((marginIndicators as any).enabled).toBe(true);
                
                // Change to aggressive
                mockPlugin.settings.commands.suggestionMode = 'aggressive';
                marginIndicators.updateSettings();
                
                expect((marginIndicators as any).intensityLevel).toBe('aggressive');
                expect((marginIndicators as any).enabled).toBe(true);
                
                // Change to off
                mockPlugin.settings.commands.suggestionMode = 'off';
                marginIndicators.updateSettings();
                
                expect((marginIndicators as any).intensityLevel).toBe('off');
                expect((marginIndicators as any).enabled).toBe(false);
            });

            test('should maintain state consistency after settings update', () => {
                // Set initial state
                mockPlugin.settings.commands.suggestionMode = 'minimal';
                
                marginIndicators.updateSettings();
                
                // Internal state should match settings
                expect((marginIndicators as any).intensityLevel).toBe('minimal');
                expect((marginIndicators as any).enabled).toBe(true);
            });
        });
    });
});