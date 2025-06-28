# Nova User Guide

Nova is an AI writing partner for Obsidian that enables direct, in-place editing of your documents. Unlike traditional AI tools that require copying and pasting, Nova writes exactly where you want it—right in your notes with real-time streaming updates.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Selection-Based Editing](#selection-based-editing)
3. [Chat Commands & Cursor-Based Editing](#chat-commands--cursor-based-editing)
4. [Document Context System](#document-context-system)
5. [AI Provider Management](#ai-provider-management)
6. [Advanced Features](#advanced-features)
7. [Troubleshooting](#troubleshooting)

---

## Getting Started

### First-Time Setup

#### 1. Configure AI Providers
Nova supports multiple AI providers. You'll need to set up at least one:

- **Claude** (Anthropic): Requires API key from console.anthropic.com
- **OpenAI**: Requires API key from platform.openai.com
- **Google AI**: Requires API key from Google AI Studio
- **Ollama**: Local AI models (no API key needed)

**To add API keys:**
1. Open Obsidian Settings → Community Plugins → Nova
2. Select your preferred provider from the dropdown
3. Enter your API key in the corresponding field
4. Test the connection by starting a conversation

#### 2. Understanding Nova's Core Philosophy

Nova operates on a **direct editing** principle:
- ✅ **Selection-based editing**: Right-click selected text for quick transformations
- ✅ **Cursor-based chat**: AI writes exactly at your cursor position
- ✅ **Streaming updates**: See text appear in real-time as AI generates it
- ❌ **No copy-paste workflow**: Nova edits your document directly

#### 3. Your First Edit

**Try this quick example:**
1. Write a sentence in any note: "The cat sat on the mat."
2. Select the text
3. Right-click and choose "Improve Writing"
4. Watch Nova enhance it in real-time

---

## Selection-Based Editing

Selection-based editing is perfect for quick transformations of existing text. Simply select any text and right-click to access Nova's transformation menu.

### The Five Core Transformations

#### 1. **Improve Writing**
- **Purpose**: Makes text clearer, more concise, with better flow
- **Best for**: Rough drafts, unclear sentences, verbose writing
- **Example**: 
  - Original: "The thing that I wanted to say is that the meeting was not very productive"
  - Improved: "The meeting was unproductive"

#### 2. **Make Longer**
- **Purpose**: Expands ideas with more detail and examples
- **Best for**: Brief notes that need elaboration, outline expansion
- **Example**:
  - Original: "Exercise is good for health"
  - Expanded: "Regular exercise provides numerous health benefits, including improved cardiovascular function, stronger bones and muscles, better mental health through endorphin release, and enhanced immune system function that helps prevent disease"

#### 3. **Make Shorter**
- **Purpose**: Condenses text to essential points
- **Best for**: Long paragraphs, wordy explanations, summary creation
- **Example**:
  - Original: A 200-word paragraph about project management
  - Condensed: A focused 50-word summary hitting key points

#### 4. **Change Tone**
- **Purpose**: Adjusts writing style and tone
- **Available tones**:
  - **Formal**: Professional, structured language for business/academic contexts
  - **Casual**: Relaxed, conversational tone for informal communication  
  - **Academic**: Scholarly, precise language with technical vocabulary
  - **Friendly**: Warm, approachable tone that builds connection
- **Example**:
  - Casual: "Hey, this project is going pretty well!"
  - Formal: "The project is progressing satisfactorily according to schedule."

#### 5. **Custom Instructions ("Tell Nova...")**
- **Purpose**: Give specific instructions for transformation
- **Best for**: Unique requirements not covered by other options
- **Examples**:
  - "Rewrite this as bullet points"
  - "Make this sound more confident" 
  - "Convert to a numbered list"
  - "Add more technical detail"

### When to Use Selection vs Chat

**Use Selection when:**
- You have existing text that needs improvement
- You want quick, standard transformations
- Working on mobile (easier than typing commands)
- Making final polish edits

**Use Chat when:**
- Adding new content
- Making complex edits requiring context
- Combining multiple operations
- Need more control over the editing process

---

## Chat Commands & Cursor-Based Editing

Chat commands let you have a conversation with Nova while it edits your document directly. Place your cursor where you want Nova to work and start typing commands.

### The Seven Core Commands

#### 1. **Add Command**
Creates new content at your cursor position.

**Syntax variations:**
```
add a section about methodology
create a paragraph explaining the benefits
write an introduction to this chapter
insert a conclusion here
```

**Example conversation:**
```
You: add a paragraph about the importance of sleep
Nova: [Writes at cursor] Sleep plays a crucial role in maintaining physical and mental health. During sleep, the body repairs tissues, consolidates memories, and releases important hormones that regulate growth and appetite...
```

#### 2. **Edit Command**  
Modifies selected text or content near the cursor.

**Syntax variations:**
```
edit this to be more formal
modify the tone to be friendlier  
change this section to focus on benefits
update this paragraph to include statistics
```

**Example:**
```
You: [Select a paragraph] edit this to be more persuasive
Nova: [Replaces selection with more compelling version]
```

#### 3. **Delete Command**
Removes specified content.

**Syntax variations:**
```
delete the third paragraph
remove this section
eliminate the redundant sentences
cut the introduction
```

#### 4. **Rewrite Command**
Restructures content with a specific style or format.

**Syntax variations:**
```
rewrite this as bullet points
rewrite in a more academic style
restructure this as a numbered list
reword this section to be clearer
```

#### 5. **Grammar Command**
Fixes grammar, spelling, and language errors.

**Syntax variations:**
```
fix grammar in this document
check spelling and grammar
correct the errors in this section
proofread this paragraph
```

#### 6. **Continue Command**
Extends writing from the current cursor position.

**Syntax variations:**
```
continue writing this section
continue with more examples
keep going with the explanation
extend this thought
```

#### 7. **Metadata Command**
Updates document properties, tags, and frontmatter.

**Syntax variations:**
```
add tags: productivity, writing, tools
update the title property
set status to complete
add suggested tags for this document
clean up the existing tags
```

### Natural Language Flexibility

Nova understands natural language, so you don't need to memorize exact syntax:

**These all work for adding content:**
- "add a conclusion"
- "write a summary at the end"
- "create a new section about results"
- "I need a paragraph explaining the process"

**These all work for editing:**
- "make this more professional"
- "edit to be shorter"
- "improve the flow of this section"
- "can you make this clearer?"

### Command Palette (Mobile & Desktop)

**Desktop**: Use the command palette for structured commands:
1. Place cursor where you want to work
2. Look for the Nova command button or use Ctrl+P
3. Select from pre-built command templates
4. Fill in the specific instruction

**Mobile**: The command palette is especially useful on mobile devices where typing longer commands is more difficult.

---

## Document Context System

Nova can work with multiple documents simultaneously by referencing them in your conversations. This enables cross-document editing and analysis.

### Document Reference Syntax

#### Basic Reference: `[[document name]]`
```
Compare this section with [[Project Requirements]]
Use the methodology from [[Research Notes]] to improve this
```

#### Property Reference: `[[document#property]]`
Extract specific frontmatter properties:
```
Set the status to match [[Project Plan#status]]
Use the same tags as [[Meeting Notes#tags]]
```

### How Document Context Works

1. **Automatic Detection**: Nova automatically finds and includes referenced documents
2. **All References are Persistent**: Once you reference a document in a conversation, Nova remembers it for the entire chat session
3. **Property Extraction**: Use `#property` syntax to reference specific frontmatter fields

### Managing Context

**Adding Documents to Context:**
- Type `[[document name]]` anywhere in your message
- Nova will automatically find and include the document
- The document stays in context for the entire conversation

**Context Panel:**
- Shows which documents are currently in context
- Displays estimated token usage
- Provides context usage warnings when approaching limits

**Context Limitations:**
- Each AI provider has different context limits
- Large documents consume more tokens
- Nova shows warnings when approaching limits
- Consider using specific properties (`[[doc#property]]`) instead of full documents for large files

### Practical Examples

**Cross-document comparison:**
```
You: Compare the writing style in this section with [[Style Guide]]
Nova: [Analyzes both documents and provides comparison]
```

**Consistent formatting:**
```
You: Format this table to match the style in [[Data Analysis]]
Nova: [Applies consistent formatting based on reference document]
```

**Template application:**
```
You: Use the structure from [[Meeting Template]] to organize these notes
Nova: [Restructures content following the template format]
```

---

## AI Provider Management

Nova supports multiple AI providers, each with different strengths and use cases.

### Supported Providers

#### Claude (Anthropic)
- **Best for**: Complex writing tasks, analysis, long-form content
- **Models**: Claude 3.5 Sonnet, Claude 3 Haiku, Claude 3 Opus
- **Setup**: Requires API key from console.anthropic.com
- **Context limit**: 200K tokens (very large)

#### OpenAI  
- **Best for**: Creative writing, code-related tasks
- **Models**: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
- **Setup**: Requires API key from platform.openai.com
- **Context limit**: Varies by model (8K-128K tokens)

#### Google AI (Gemini)
- **Best for**: Factual content, research tasks
- **Models**: Gemini Pro, Gemini Pro Vision
- **Setup**: Requires API key from Google AI Studio
- **Context limit**: 1M tokens (extremely large)

#### Ollama (Local)
- **Best for**: Privacy-conscious users, offline work
- **Models**: Llama 2, Code Llama, Mistral, many others
- **Setup**: Install Ollama locally, no API key needed
- **Context limit**: Varies by model and system resources

### Switching Providers

**During a conversation:**
1. Use the provider dropdown in the Nova sidebar
2. Select a different provider
3. Continue the conversation with the new provider
4. Context and conversation history are preserved

**Provider selection strategy:**
- **Complex analysis**: Claude or GPT-4
- **Quick edits**: Claude Haiku or GPT-3.5 Turbo  
- **Privacy required**: Ollama local models
- **Large context needed**: Google Gemini

### Managing API Keys

**Adding keys:**
1. Settings → Community Plugins → Nova
2. Select provider tab
3. Enter API key
4. Test connection

**Security notes:**
- API keys are stored locally in Obsidian
- Keys are not shared or transmitted except to the respective AI service
- Consider using environment variables for added security

### Handling Provider Errors

**Common issues and solutions:**

**"API key invalid"**
- Verify key is correctly copied
- Check if key has necessary permissions
- Ensure account has sufficient credits

**"Rate limit exceeded"**
- Wait before retrying
- Consider switching to a different provider temporarily
- Check your API usage on the provider's dashboard

**"Context limit exceeded"**
- Remove some document references
- Use property references (`[[doc#property]]`) instead of full documents
- Switch to a provider with larger context limits

---

## Advanced Features

### Streaming Text with Magical Scroll

Nova provides real-time streaming updates as the AI generates text:

**How it works:**
- Text appears letter-by-letter as the AI writes
- Your view automatically scrolls to follow the cursor
- "Thinking..." indicators show when the AI is processing
- Smooth, uninterrupted writing experience

**Benefits:**
- See progress in real-time
- Catch issues early and stop generation if needed
- Natural writing flow that feels collaborative

### Tag Management

Nova includes specialized commands for managing document tags:

**Adding suggested tags:**
```
add suggested tags
```
Nova analyzes your document and suggests relevant tags.

**Cleaning up tags:**
```
clean up tags
optimize the existing tags
review and improve the tag structure
```

**Specific tag operations:**
```
add tags: productivity, writing, AI
remove the #draft tag
update tags to be more specific
```

### Frontmatter Operations

**Updating properties:**
```
set status to "in-progress"
update the author field
add creation date
set priority to high
```

**Property management:**
```
clean up the frontmatter
organize the properties alphabetically
remove unused properties
```

### Custom Commands

Create your own reusable commands in Nova settings:

1. Settings → Community Plugins → Nova → Features → Commands
2. Add custom command with template
3. Use variables like `{selection}` and `{cursor}`
4. Access through command palette

**Example custom command:**
- Name: "Academic Citation"
- Template: "Convert {selection} to academic citation format"
- Usage: Select text → Command palette → "Academic Citation"

### Mobile-Specific Features

**Optimized for mobile:**
- Touch-friendly selection menus
- Command palette for easier command entry
- Simplified interface for smaller screens
- Voice-to-text support for commands

**Mobile best practices:**
- Use selection-based editing when possible
- Leverage command palette for complex commands
- Take advantage of voice input for longer instructions

---

## Troubleshooting

### Common Issues and Solutions

#### **Nova doesn't respond to commands**

**Possible causes:**
- No AI provider configured
- Invalid API key
- Network connectivity issues
- Rate limiting

**Solutions:**
1. Check provider settings and API key
2. Test internet connection
3. Try switching providers
4. Wait if rate limited, then retry

#### **Text appears garbled or incomplete**

**Possible causes:**
- Network interruption during streaming
- Context limit exceeded
- Provider-specific issues

**Solutions:**
1. Stop generation and retry
2. Reduce context by removing document references
3. Switch to provider with larger context limits
4. Check network stability

#### **Selection menu doesn't appear**

**Possible causes:**
- Text not properly selected
- Plugin not fully loaded
- Conflicting plugins

**Solutions:**
1. Ensure text is clearly selected
2. Restart Obsidian
3. Disable other AI plugins temporarily
4. Check for plugin updates

#### **Commands not recognized**

**Possible causes:**
- Typos in command syntax
- Cursor not positioned correctly
- Command not supported by current provider

**Solutions:**
1. Try natural language variations
2. Use command palette for structured commands
3. Check cursor placement
4. Refer to command examples in this guide

### Performance Optimization

#### **Faster response times:**
- Use faster models (Claude Haiku, GPT-3.5 Turbo)
- Minimize document context when possible
- Use property references instead of full documents
- Keep commands concise and specific

#### **Reducing token usage:**
- Reference specific properties instead of full documents
- Remove unnecessary documents from context
- Use selection-based editing for small changes
- Break large tasks into smaller operations

#### **Network optimization:**
- Ensure stable internet connection
- Consider local providers (Ollama) for offline work
- Use wired connection when possible for large operations

### Context Limit Management

**Understanding limits:**
- Each provider has different context windows
- Larger context = higher costs and slower responses
- Nova shows warnings when approaching limits

**Managing context effectively:**
1. **Monitor the context indicator** in the sidebar
2. **Use specific properties** (`[[doc#tags]]`) instead of full documents
3. **Remove unnecessary document references** from conversation
4. **Split large tasks** into smaller, focused operations
5. **Switch to providers with larger context** (Google Gemini) when needed

**Context usage tips:**
- Start conversations with minimal context
- Add documents only when necessary
- Use "continue" commands instead of re-providing context
- Clear context and start fresh for unrelated tasks

### Mobile-Specific Issues

#### **Touch selection problems:**
- Use precise finger positioning
- Try double-tap to select words
- Use selection handles to adjust boundaries
- Consider using stylus for precision

#### **Command input difficulties:**
- Use voice-to-text for longer commands
- Leverage command palette instead of typing
- Create custom commands for frequently used operations
- Take advantage of autocomplete suggestions

### Getting Help

**If issues persist:**
1. Check the Nova plugin settings for updates
2. Review Obsidian console for error messages (Ctrl+Shift+I)
3. Try disabling other plugins to identify conflicts
4. Report bugs through the plugin's GitHub repository
5. Join the community discussions for user tips and solutions

---

## Best Practices

### Workflow Recommendations

1. **Start with selection-based editing** for quick improvements
2. **Use chat commands for new content** and complex edits  
3. **Reference documents strategically** - add context only when needed
4. **Monitor token usage** to avoid hitting limits
5. **Experiment with different providers** to find what works best for your tasks

### Writing Efficiently with Nova

1. **Draft first, polish later**: Write rough content, then use selection-based editing to improve
2. **Layer your edits**: Make multiple small improvements rather than trying to perfect everything at once
3. **Use templates**: Reference well-structured documents to maintain consistency
4. **Combine approaches**: Use chat for structure, selection for refinement

### Maximizing AI Effectiveness

1. **Be specific in commands**: "Make this more professional" works better than "improve this"
2. **Provide context when needed**: Reference relevant documents for consistency
3. **Use the right tool for the task**: Quick fixes with selection, complex work with chat
4. **Iterate and refine**: Don't expect perfection on the first try

Nova transforms how you work with text in Obsidian. By mastering both selection-based editing and chat commands, you'll develop a powerful, efficient writing workflow that feels natural and intuitive.