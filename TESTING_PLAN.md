# Nova Plugin - Gemini API Testing Plan

## Overview
Comprehensive testing plan for Nova plugin using real Gemini API key to validate production readiness.

**Total Estimated Time:** 85 minutes
**API Provider:** Google Gemini (cost-effective alternative to Claude)
**Testing Date:** To be scheduled

---

## Current State Analysis

✅ **Gemini Provider is Fully Implemented**
- Complete Google provider with Gemini API integration (`src/ai/providers/google.ts`)
- Settings UI for Gemini API key input (`src/settings.ts`)
- Provider manager handles Gemini selection and fallbacks (`src/ai/provider-manager.ts`)
- All core methods implemented: `complete()`, `chatCompletion()`, `generateText()`

✅ **All Core Features Complete**
- Tasks 7.6-8.7 are all completed with comprehensive test coverage
- Only remaining task: 8.8 "Test with real API key"

---

## Phase 1: Basic Setup & Configuration Testing (10 min)

### 1.1 Settings Configuration
- Open Nova settings via Obsidian Settings > Community Plugins > Nova
- Configure Google (Gemini) section:
  - Enter real Gemini API key (format: AIza...)
  - Select model: Test with "gemini-2.5-flash" (fastest/cheapest)
  - Set temperature: 0.7 (default)
  - Set max tokens: 1000 (default)
- Save settings and verify they persist

### 1.2 Provider Selection
- Navigate to Platform Settings section
- Set Desktop Primary Provider to "Google"
- Verify provider status shows "Google (Gemini)" in sidebar header
- Check that green status dot appears indicating connection

### 1.3 Plugin Activation
- Click Nova star icon in ribbon to open sidebar
- Verify sidebar opens with "Nova - Your AI Thinking Partner" header
- Confirm welcome message appears
- Test "Clear Chat" button functionality

---

## Phase 2: Basic Chat Functionality Testing (15 min)

### 2.1 Simple Conversation Testing
- Send basic message: "Hello, can you help me?"
- Verify loading indicator appears ("Nova is thinking...")
- Confirm AI response appears with proper formatting
- Test message history persistence across file switches

### 2.2 Input Interface Testing
- Test Enter key sends message (without Shift)
- Test Shift+Enter creates new line in textarea
- Test "Send" button functionality
- Verify input clears after sending
- Test button disable/enable during processing

### 2.3 Error Handling
- Send message with invalid API key to test error display
- Restore valid key and verify recovery
- Test network timeout scenarios if possible

---

## Phase 3: Document Command Testing (20 min)

### 3.1 Test Environment Setup
Create test markdown file: "Nova Test Document.md"
Add sample content:
```markdown
# Test Document

This is a test paragraph with some mispelled words and grammar errors.

## Section 1
Content that needs editing.

## Section 2
More content here.
```

### 3.2 Add Command Testing
- Select text and ask: "Add a bullet list of 3 programming languages after this"
- Test without selection: "Add a conclusion section"
- Verify content is inserted at correct positions
- Test undo (Cmd/Ctrl+Z) works properly

### 3.3 Edit Command Testing
- Select text and ask: "Make this more professional"
- Test paragraph editing: "Rewrite this paragraph to be clearer"
- Verify original text is replaced correctly
- Test undo functionality

### 3.4 Grammar Command Testing
- Use command palette: "Nova: Fix grammar"
- Test on document with intentional errors
- Test on selected text vs whole document
- Verify corrections are appropriate

### 3.5 Delete Command Testing
- Ask: "Delete the second section"
- Test: "Remove the bullet list I just added"
- Verify targeted deletion works correctly
- Test undo after deletion

### 3.6 Rewrite Command Testing
- Select text and ask: "Rewrite this in a more casual tone"
- Test: "Make this section more technical"
- Verify style changes are applied appropriately

---

## Phase 4: Advanced Functionality Testing (15 min)

### 4.1 File-Scoped Conversation Testing
- Open multiple markdown files
- Send messages in each file
- Switch between files and verify conversation history loads
- Test conversation persistence across Obsidian restarts

### 4.2 Command vs Conversation Detection
- Test direct commands: "Edit the first paragraph"
- Test conversational queries: "What are the main themes in this document?"
- Verify appropriate routing to command handlers vs general chat

### 4.3 Context Awareness Testing
- Ask questions about document content
- Test: "Summarize the main points of this document"
- Test: "What should I add to make this more complete?"
- Verify AI has proper document context

---

## Phase 5: Integration & Performance Testing (10 min)

### 5.1 Provider Switching Testing
- Configure multiple providers (if available)
- Test fallback mechanism by temporarily disabling primary
- Verify smooth provider transitions

### 5.2 Performance Testing
- Test with large documents (>1000 words)
- Test rapid-fire message sending
- Monitor response times and UI responsiveness
- Test concurrent operations

### 5.3 Edge Cases
- Test with empty documents
- Test with documents containing special characters
- Test very long messages (approaching token limits)
- Test rapid file switching during AI processing

---

## Phase 6: Real-World Scenario Testing (15 min)

### 6.1 Writing Workflow
- Create a new article draft
- Use Nova to brainstorm topics
- Add sections with Nova's help
- Edit and refine content iteratively
- Test complete writing workflow

### 6.2 Document Analysis
- Open existing document
- Ask for analysis and suggestions
- Request specific improvements
- Test Nova's understanding of content structure

### 6.3 Research Assistance
- Ask Nova to help explain complex topics
- Request examples and analogies
- Test fact-checking and clarification requests

---

## Verification Checklist

### Core Functionality
- [ ] Gemini API key authentication works
- [ ] Provider status shows correctly in sidebar
- [ ] All 5 command types execute successfully
- [ ] Undo/redo works for all AI-generated changes
- [ ] Conversation history persists per file
- [ ] Error handling displays helpful messages

### UI/UX
- [ ] Chat interface is responsive and clear
- [ ] Message formatting is proper (user vs assistant)
- [ ] Loading indicators work during processing
- [ ] Input field behaves correctly
- [ ] Settings save and load properly

### Document Integration
- [ ] Text selection detection works
- [ ] Content insertion happens at correct locations
- [ ] Document structure is preserved during edits
- [ ] File switching loads correct conversations

### Performance & Reliability
- [ ] Response times are acceptable (<10 seconds)
- [ ] No memory leaks during extended use
- [ ] Error recovery works properly
- [ ] Multiple file workflows are smooth

---

## Expected Outcomes

### Success Criteria
- All command types work with real content
- Conversation flows naturally with document context
- No data loss or corruption during editing
- Performance remains acceptable under normal use
- Error handling prevents crashes or data loss

### Potential Issues to Monitor
- Gemini API rate limiting or quota issues
- Network connectivity problems
- Token limit exceeded errors
- Context window limitations with large documents
- UI freezing during long operations

---

## Security Notes
- API key stored securely in Obsidian's local settings
- No sensitive data in source code or version control
- User maintains full control over API access and usage
- Testing can be stopped at any time to prevent cost overruns

---

## Next Steps After Testing
1. Document any issues found during testing
2. Create fixes for critical bugs
3. Update documentation with usage examples
4. Prepare for production release
5. Consider adding usage analytics (optional)

---

**Testing Status:** Ready to begin
**Prerequisites:** Valid Gemini API key with available quota
**Environment:** Local Obsidian installation with Nova plugin loaded