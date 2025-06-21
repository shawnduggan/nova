# Nova - Your AI Writing Partner for Obsidian

I built Nova because I was tired of copying and pasting between ChatGPT and my notes.

Nova solves this with precise AI editing - select text and right-click, or use chat commands that edit exactly at your cursor. No more guessing, no more copy-paste chaos.

**✨ AI edits exactly where you want**  
**🔒 Privacy-first with local AI or your own API keys**  
**🆓 Every feature free forever with your API keys**

## 🎯 The Problem Every Writer Knows

**Before Nova (Every Other AI Tool):**
- User: "Improve this paragraph"
- AI: *Makes edit somewhere, hopefully in the right place*
- User: "Wait, where did it put that? Let me find it and move it..."
- Result: **Constant copy-paste frustration and guesswork**

**With Nova:**
- **Selection**: *Select text → Right-click → "Improve Writing"*
- **Cursor**: *Type "Add conclusion here" → AI writes exactly at cursor*
- Result: **Surgical precision, zero copy-paste**

## ✨ Features

### 🎯 Selection-Based Editing with Streaming Magic

Transform any selected text directly in place with magical streaming effects:

**Desktop Experience:**
- **Select text → Right-click** to access Nova's context menu
- **Powerful actions**: Improve Writing, Make Longer/Shorter, Change Tone, Custom Instructions, and more
- **Typewriter streaming**: Watch AI content appear with smooth streaming effects
- **Clean undo behavior**: Two-step undo (AI content → empty → original text)

**Mobile Experience:**
- **Select text → Command Palette** (Cmd/Ctrl+P or tap command icon)
- **Search "Nova:"** to find all selection actions
- **Complete feature parity** with desktop - all 8 actions, chat commands, file context
- **Perfect text selection preservation** during transformation

### 💬 Intelligent Chat & Document Editing

Full conversation capability with smart editing detection:

- **Chat about your notes**: "What are the main themes in this document?" 
- **Ask questions**: "How does this relate to my research in [[Other Document]]?"
- **Smart intention detection**: AI knows when to chat vs. when to edit your document
- **Cursor-precise editing**: "Add a conclusion here" edits exactly at cursor location
- **Same streaming experience**: Whether chatting or editing on desktop or mobile

### 📁 Drag-and-Drop File Context

Seamless file integration for multi-document workflows:

- **Drag markdown files** from Obsidian's file explorer onto chat input
- **Auto-context addition**: Files automatically added to conversation context
- **Multiple file support**: Drag several files simultaneously  
- **Smart filtering**: Only accepts `.md` files with friendly error messages
- **Visual feedback**: Accent-colored drop zone during drag operations

### 🤖 AI Provider Flexibility

**Local Providers (Privacy-First):**
- **Ollama** (recommended for desktop) - Complete privacy, no internet required
- **LM Studio** - Alternative local option
- **Custom endpoints** - Self-hosted AI models

**Cloud Providers (with your API keys):**
- **Claude** (Anthropic) - Recommended for quality and reasoning
- **Google Gemini** - Fast and budget-friendly
- **OpenAI** (ChatGPT) - Industry standard

**Provider Features:**
- **Seamless switching**: Change providers mid-conversation
- **Context preservation**: Full conversation history maintained across switches
- **API resilience**: Automatic retry with exponential backoff for server errors
- **Clear privacy indicators**: 🔒 Local / ☁️ Cloud status display

### 🗂️ Smart Multi-Document Context

Include content from other vault documents in your conversation:

- **File picker**: Type `[[` to open Obsidian's fuzzy search and select documents
- **Drag and drop**: Drag markdown files from file explorer directly onto chat input
- **Persistent context**: Added files stay active across the entire conversation
- **Context management**: Visual panel with remove buttons and clear all option
- **Security protection**: Context documents are read-only for editing operations

### 🏷️ AI-Powered Tag Management

Natural language tag operations:

- **"Add tags: research, important"** - Modifies document metadata directly
- **"Add suggested tags"** - AI analyzes content and suggests relevant tags
- **"Clean up tags"** - Optimizes and deduplicates tag lists
- **Smart formatting**: Converts spaces to hyphens automatically
- **Success feedback**: Clear messages showing tag changes

### 💾 File-Scoped Memory & Enhanced UX

- **File-scoped conversations**: Each document maintains its own chat history
- **Auto-growing input**: Platform-specific sizing (desktop 6 lines, mobile 2 lines)
- **Enhanced input experience**: Smooth transitions and auto-reset after submission
- **Memory management**: Automatic 7-day conversation cleanup
- **Native modals**: Professional Obsidian-style design throughout

## 🚀 Getting Started

### 1. Installation
- Install from Obsidian Community Plugins (search "Nova")
- Or download from [GitHub Releases](https://github.com/shawnduggan/nova-obsidian/releases)

### 2. Configure Your AI Provider

**Desktop Users**: Nova ships ready-to-use with Ollama as the default local AI provider.

**Mobile Users**: Configure a cloud provider since local AI isn't available on mobile.

**Setup Steps:**
1. Open **Settings** → **Nova AI Settings**
2. **For local AI (desktop)**: Install [Ollama](https://ollama.ai/) and pull a model (`ollama pull llama3`)
3. **For cloud AI**: Add your API key:
   - **Claude**: [Anthropic Console](https://console.anthropic.com/)
   - **OpenAI**: [OpenAI Platform](https://platform.openai.com/)
   - **Google**: [Google AI Studio](https://aistudio.google.com/)

### 3. Start Transforming Text
1. **Open any document** in Obsidian
2. **Select some text**
3. **Desktop**: Right-click → Choose Nova action
4. **Mobile**: Command Palette (Cmd/Ctrl+P) → Search "Nova: Improve Writing"
5. **Watch the magic**: Thinking animation → Streaming transformation in place

### 4. Pro Workflows
- **Provider switching**: Change AI models mid-conversation
- **File context**: Type `[[` to add other documents to conversation
- **Cursor targeting**: "Add conclusion section" for precise document additions
- **Custom instructions**: Right-click → "Tell Nova..." for specific transformations

## 🎮 Usage Examples

### Academic Writing
```
Select methodology paragraph → Right-click → "Change Tone to Academic"
Nova: *Transforms text with academic language and structure*

Type: "Add literature review section using context from [[Research Notes]]"
Nova: *Creates structured academic section with proper citations*
```

### Creative Writing
```
Select character description → Right-click → "Make Longer"
Nova: *Expands with rich details and backstory*

Chat: "Create dialogue showing tension between these characters"
Nova: *Generates compelling dialogue at cursor position*
```

### Technical Documentation
```
Select API description → Right-click → "Improve Writing" 
Nova: *Enhances clarity and technical accuracy*

Chat: "Add error handling examples using [[API Guidelines]]"
Nova: *References guidelines and adds appropriate code samples*
```

## 🎭 Why Nova Is Different

### Selection-Based Revolution
- **End the guesswork**: AI edits exactly where you specify, not where it hopes
- **Visual precision**: See exactly what will be transformed before it happens
- **Magical UX**: Polished interactions with smooth animations that make editing enjoyable
- **Zero learning curve**: Right-click and selection are universal patterns

### Native Obsidian Integration
- **Feels like core Obsidian**: Uses native modals, command palette, file picker
- **Obsessive UX polish**: Every interaction crafted to feel seamless and intuitive
- **Cross-platform excellence**: Identical experience on desktop and mobile
- **Privacy-first**: Local AI emphasis with optional cloud using your keys
- **Community-supported**: All features free with your API keys

### Built for Writers
- **Direct document editing**: No copy-paste workflow interruption
- **Context-aware**: Understands document structure and writing style
- **Multi-document intelligence**: Reference and incorporate other notes seamlessly
- **Writing flow preservation**: Maintains focus without external chat windows

## 🛠️ Technical Excellence

### Performance & Reliability
- **API resilience**: Automatic retry with exponential backoff (1s, 2s, 4s)
- **Memory management**: Efficient resource usage with automatic cleanup
- **Streaming optimization**: Smooth typewriter effects with 20ms character timing
- **Cross-platform consistency**: Identical experience across all devices

### Security & Privacy
- **Local-first architecture**: Ollama provider requires no internet connection
- **Secure API storage**: Keys encrypted using Obsidian's secure settings
- **Context document protection**: Read-only security for multi-document workflows
- **No analytics**: Zero usage tracking or data collection
- **Offline license validation**: Supernova licenses work completely offline - nothing calls home, ever

### Code Quality
- **400+ comprehensive tests**: Including security, performance, and integration suites
- **TypeScript**: Full type safety and maintainability
- **Zero dependencies**: Self-contained with no external runtime requirements
- **Open source**: AGPL-3.0 license for transparency and community contribution

## 🌟 Community & Support

### Free Forever
**Every feature is available to everyone with their own API keys.** No artificial restrictions, no feature gates, no subscription walls.

### Supernova Support
If Nova transforms your writing workflow, consider supporting development:
- **Priority support** when you need help
- **Early access** to new features (2-4 months ahead)
- **Community voice** in development priorities
- **Sustainable development** funding

**[Go Supernova! →](https://github.com/sponsors/shawnduggan)**

### Get Involved
- **🐛 Issues**: [GitHub Issues](https://github.com/shawnduggan/nova-obsidian/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/shawnduggan/nova-obsidian/discussions)  
- **📚 Documentation**: [User Guide](https://docs.novawriter.ai)
- **🤝 Contributing**: [Contributing Guide](./CONTRIBUTING.md)

## 🔮 What's Next

Nova is actively developed with exciting features planned:

**Coming Soon for Supernova Supporters** *(Regular users get access 2-4 months later)*:
- **Custom Commands** (July 2025): Create your own editing workflows
- **Writing Modes**: Specialized environments for different writing styles
- **Personalized Style Mirroring**: AI learns and adapts to your unique voice
- **Smart Content Synthesis**: Merge insights from multiple sources intelligently
- **And more!** Supernova supporters vote on priorities and help shape development

## 📄 License & Requirements

### License
Nova is open source under **AGPL-3.0**, ensuring:
- ✅ **Free forever** for all uses (personal, commercial, enterprise)
- ✅ **Community contributions** protected and shared
- ✅ **No hidden restrictions** or commercial exploitation
- ✅ **Transparent development** with public code

### Requirements
- **Obsidian**: v1.0.0 or newer
- **AI Provider**: Ollama (local) or cloud API key
- **Platforms**: Windows, macOS, Linux, iOS, Android

---

## 🎯 Ready to End AI Guesswork?

**Stop hoping AI gets it right. Start controlling exactly where it goes.**

Transform your writing workflow with surgical precision:

1. **[Install Nova](https://obsidian.md/plugins?id=nova)** from Community Plugins
2. **Select some text** in any document  
3. **Right-click → "Improve Writing"**
4. **Watch the magic** happen exactly where you want it

**Built with ❤️ in Halifax, Nova Scotia 🇨🇦**