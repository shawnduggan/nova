# Pre-Testing Critical Tasks

## Overview
These tasks must be completed before we can test the Nova plugin. They represent the minimum viable implementation needed to verify core functionality.

## Task 7: Wire Up Sidebar Chat UI
**Current State**: Sidebar view exists but has no chat interface
**Priority**: HIGH - Must complete first

### 7.1: Add message container div to sidebar
- Add a scrollable container for chat messages
- Set appropriate CSS classes for styling
- Ensure it takes up most of the sidebar space

### 7.2: Add message display function
- Create function to render messages (user/assistant/system)
- Different styling for each message type
- Include timestamp display

### 7.3: Add input field at bottom of sidebar
- Text input for user messages
- Placeholder text: "Ask Nova to help edit..."
- Auto-focus when sidebar opens

### 7.4: Add send button next to input
- Button to trigger message send
- Disabled state when input is empty
- Visual feedback on click

### 7.5: Wire Enter key to send message
- Capture Enter key in input field
- Shift+Enter for new line
- Clear input after send

### 7.6: Display provider name and status
- Show current AI provider in header
- Connection status indicator
- Error state display

### 7.7: Load conversation history on file change
- Load from conversation JSON files
- Display previous messages
- Scroll to bottom on load

### 7.8: Add "Clear Chat" button to header
- Button to clear current conversation
- Confirmation dialog
- Reset conversation file

## Task 8: Connect AI Providers to Commands
**Current State**: Providers exist but not wired to commands
**Priority**: HIGH - Required for any AI functionality

### 8.1: Implement Claude provider complete() method
- Build API request format
- Handle authentication headers
- Parse response correctly

### 8.2: Add system/user prompt building
- Create prompts for each command type
- Include document context
- Format for Claude API

### 8.3: Connect sidebar input to command parser
- Parse user input on send
- Detect command type
- Extract parameters

### 8.4: Route parsed commands to handlers
- Map command types to handlers
- Pass correct context
- Handle unknown commands

### 8.5: Display AI response in chat
- Show assistant message
- Format code blocks if present
- Handle streaming responses

### 8.6: Show loading indicator during AI call
- Visual feedback during processing
- Disable input during request
- Cancel button option

### 8.7: Handle and display errors gracefully
- Network errors
- API errors
- Rate limiting
- Invalid commands

### 8.8: Test with real Claude API key
- Verify authentication works
- Test actual API calls
- Check response handling

## Task 9: Test Core Functionality
**Current State**: Ready once Tasks 7 & 8 complete
**Priority**: MEDIUM - Final validation

### 9.1: Test "add a section about X" command
- Verify section insertion
- Check formatting
- Test undo functionality

### 9.2: Test "edit this paragraph" with selection
- Select text first
- Run edit command
- Verify replacement

### 9.3: Test "fix grammar" on whole document
- Run on document with errors
- Check corrections
- Verify no content loss

### 9.4: Test "delete section X"
- Identify section by heading
- Verify correct deletion
- Test undo

### 9.5: Test "rewrite this" with selection
- Select paragraph
- Request rewrite
- Compare results

### 9.6: Verify Cmd+Z undo works
- Test after each command
- Multiple undo levels
- Redo functionality

### 9.7: Test provider switching
- Change provider in settings
- Verify new provider used
- Test fallback behavior

### 9.8: Add basic CSS styling
- Message bubbles
- Input styling
- Provider status
- Loading states

## Implementation Order
1. **Start with Task 7.1-7.5**: Get basic chat UI working
2. **Then Task 8.1-8.3**: Connect Claude provider
3. **Complete Task 7.6-7.8**: Finish UI features
4. **Finish Task 8.4-8.8**: Complete AI integration
5. **Run through Task 9**: Validate everything works

## Time Estimates
- Task 7: 2-3 hours (UI work)
- Task 8: 3-4 hours (AI integration)
- Task 9: 1-2 hours (testing & fixes)
- **Total: 6-9 hours of focused work**

## Success Criteria
- User can type message in sidebar
- Message gets parsed as command
- AI provider processes command
- Document gets modified
- Result appears in chat
- Undo works properly