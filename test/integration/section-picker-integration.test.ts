import { DocumentEngine } from '../../src/core/document-engine';
import { CommandParser } from '../../src/core/command-parser';
import ObsidianMock from '../mocks/obsidian-mock';

describe('Section Path Integration', () => {
    let mockApp: any;
    let documentEngine: DocumentEngine;
    let commandParser: CommandParser;

    beforeEach(() => {
        mockApp = new ObsidianMock.App();
        documentEngine = new DocumentEngine(mockApp);
        commandParser = new CommandParser();

        // Mock document content with hierarchical sections
        const mockContent = `# Research Paper
This is the introduction.

## Methods
Details about methodology.

### Data Collection
How we collected data.

#### Survey Design  
Survey methodology details.

### Analysis
How we analyzed data.

## Results
The findings.

### Statistical Analysis
Statistical results.

## Conclusion
Final thoughts.`;

        const mockEditor = {
            getValue: () => mockContent,
            getCursor: () => ({ line: 0, ch: 0 }),
            getSelection: () => '',
            replaceRange: jest.fn(),
            replaceSelection: jest.fn(),
            setSelection: jest.fn(),
            scrollIntoView: jest.fn(),
            lastLine: () => 20,
            getLine: () => '',
            setSelectionRange: jest.fn(),
            focus: jest.fn(),
            selectionStart: 0,
            selectionEnd: 0
        };

        const mockFile = {
            basename: 'research-paper',
            path: 'research-paper.md'
        };

        mockApp.workspace.getActiveViewOfType = jest.fn().mockReturnValue({
            editor: mockEditor
        });
        mockApp.workspace.getActiveFile = jest.fn().mockReturnValue(mockFile);
        mockApp.vault.modify = jest.fn();
    });

    afterEach(() => {
        // Cleanup if needed
    });

    describe('Section Path Generation', () => {
        it('should generate hierarchical section paths', async () => {
            const sections = await documentEngine.getAllSectionPaths();
            
            expect(sections).toHaveLength(8); // All headings including title
            
            // Check top-level sections
            const researchPaper = sections.find(s => s.headingText === 'Research Paper');
            expect(researchPaper?.targetPath).toBe('Research Paper');
            expect(researchPaper?.displayName).toBe('📄 Research Paper');
            
            // Check nested sections
            const dataCollection = sections.find(s => s.headingText === 'Data Collection');
            expect(dataCollection?.targetPath).toBe('Research Paper/Methods/Data Collection');
            expect(dataCollection?.displayName).toBe('    Data Collection');
            
            // Check deeply nested sections  
            const surveyDesign = sections.find(s => s.headingText.trim() === 'Survey Design');
            expect(surveyDesign?.targetPath).toBe('Research Paper/Methods/Data Collection/Survey Design  ');
            expect(surveyDesign?.displayName).toBe('      Survey Design  ');
        });

        it('should provide content previews', async () => {
            const sections = await documentEngine.getAllSectionPaths();
            
            const methods = sections.find(s => s.headingText === 'Methods');
            expect(methods?.preview).toContain('Details about methodology');
            
            const results = sections.find(s => s.headingText === 'Results');
            expect(results?.preview).toContain('The findings');
        });
    });

    describe('Section Finding with Paths', () => {
        it('should find sections using hierarchical paths', async () => {
            // Test finding nested section with full path
            const section = await documentEngine.findSection('Research Paper/Methods/Data Collection');
            expect(section).not.toBeNull();
            expect(section?.heading).toBe('Data Collection');
            
            // Test finding another nested section that should work
            const analysisSection = await documentEngine.findSection('Research Paper/Methods/Analysis');
            expect(analysisSection).not.toBeNull();
            expect(analysisSection?.heading).toBe('Analysis');
        });

        it('should find sections using legacy :: syntax', async () => {
            const section = await documentEngine.findSection('Research Paper::Methods::Data Collection');
            expect(section).not.toBeNull();
            expect(section?.heading).toBe('Data Collection');
        });

        it('should find sections using simple names', async () => {
            const section = await documentEngine.findSection('Results');
            expect(section).not.toBeNull();
            expect(section?.heading).toBe('Results');
        });
    });

    describe('Command Parser Integration', () => {
        it('should convert path syntax correctly', () => {
            const input = 'append content to Methods/Data Collection';
            const command = commandParser.parseCommand(input);
            
            expect(command.action).toBe('add');
            expect(command.instruction).toBe('append content to Methods/Data Collection');
        });

        it('should handle semantic commands with paths', () => {
            const input = 'prepend warning to Methods/Data Collection';
            const command = commandParser.parseCommand(input);
            
            expect(command.action).toBe('add');
            expect(command.instruction).toBe('prepend warning to Methods/Data Collection');
        });
    });


    describe('End-to-End Integration', () => {
        it('should support full workflow: semantic command + section paths + section finding', async () => {
            // 1. Parse semantic command
            const input = 'append conclusion to Research Paper/Methods/Data Collection';
            const command = commandParser.parseCommand(input);
            
            expect(command.action).toBe('add');
            expect(command.instruction).toContain('Research Paper/Methods/Data Collection');
            
            // 2. Verify section can be found with the path
            const section = await documentEngine.findSection('Research Paper/Methods/Data Collection');
            expect(section).not.toBeNull();
            expect(section?.heading).toBe('Data Collection');
            
            // 3. Verify getAllSectionPaths can provide this section
            const sections = await documentEngine.getAllSectionPaths();
            const targetSection = sections.find(s => s.targetPath === 'Research Paper/Methods/Data Collection');
            expect(targetSection).not.toBeNull();
            expect(targetSection?.headingText).toBe('Data Collection');
            
            // 4. Verify the section has proper display formatting
            expect(targetSection?.displayName).toBe('    Data Collection'); // Indented for level 3
        });
    });
});