# Nova - AI Thinking Partner for Obsidian

**Stop copying from chat. Start collaborating with AI.**

I built Nova for myself because copy-pasting between ChatGPT and Obsidian was killing my writing flow. Every feature exists because I hit that exact friction in my own work. I'm sharing it as my passion project for the Obsidian community.

Nova transforms AI from a chat interface into a true collaborative writing partner that directly edits, enhances, and creates content in your documents through natural conversation.

## 🌟 What Makes Nova Different

**Direct Document Editing**: Unlike other AI tools that make you copy-paste suggestions, Nova edits your documents directly where you write.

**Native Obsidian Integration**: Nova feels like part of Obsidian, not an add-on. I obsessed over the details - from using `[[]]` autocomplete to matching Obsidian's design language and keyboard shortcuts. Everything just works the way you'd expect.

**Privacy-First**: Choose between local AI (completely private) or cloud providers using your own API keys. Your data, your choice.

**Everything Free**: All features are available to everyone with their own API keys. No artificial restrictions, no feature gates.

**Works Everywhere**: Identical full-featured experience on desktop and mobile - only the AI provider setup differs by platform.

**Community-Supported**: Optional Supernova supporters get early access to new features and help sustain development.

## ✨ Features

### 🔧 Core Document Editing
- **Add Content**: "Add a conclusion section about..."
- **Edit Content**: "Make this paragraph more professional..."
- **Delete Content**: "Remove the redundant parts..."
- **Fix Grammar**: Automatically correct grammar and clarity
- **Rewrite Content**: "Rewrite this to be more compelling..."
- **Update Metadata**: "Add tags: research, important"

### 🤖 AI Provider Support
- **Claude (Anthropic)**: Premium reasoning capabilities
- **ChatGPT (OpenAI)**: Industry-standard AI assistance  
- **Google Gemini**: Fast, efficient responses
- **Ollama**: Local AI models for complete privacy
- **Provider Switching**: Switch AI models mid-conversation with `:claude`, `:gemini`, `:gpt4`

### 🎯 Smart Writing Features
- **Multi-Document Context**: Reference other notes with `[[Document Name]]` syntax - uses Obsidian's native autocomplete with document suggestions
- **File-Scoped Conversations**: Each document maintains its own chat history
- **Auto-Growing Input**: Smart input area that expands as you type
- **Quick Commands**: Use `:` to trigger instant commands like `:claude` (switch to Claude) or `:grammar` (fix grammar) - designed for fast mobile and desktop typing
- **Context-Aware Editing**: AI understands your document structure and tone
- **Mobile & Desktop**: Full functionality across all platforms

### ⚡ Advanced Workflow
- **Natural Language Commands**: Describe what you want in plain English
- **Undo Integration**: All edits work with Obsidian's native undo/redo
- **Privacy Indicators**: Clear visual indicators for local vs cloud AI usage
- **Provider Health Monitoring**: Automatic fallback when providers are unavailable

## 🚀 Getting Started

### 1. Installation
- Install from Obsidian Community Plugins (search "Nova")
- Or download from [GitHub Releases](https://github.com/shawnduggan/nova-obsidian/releases)

### 2. Configure Your AI Provider

**Desktop Users**: Nova ships ready-to-use with Ollama as the default local AI provider.

**Mobile Users**: You'll need to configure a cloud provider since local AI isn't available on mobile.

Setup options:
1. Open **Settings** → **Nova AI Settings**
2. **For local AI (desktop only)**: Install [Ollama](https://ollama.ai/) and pull a model (e.g., `ollama pull llama2`)
3. **For cloud AI** (required for mobile, optional for desktop), add API keys:
   - **Claude**: Get API key from [Anthropic Console](https://console.anthropic.com/)
   - **OpenAI**: Get API key from [OpenAI Platform](https://platform.openai.com/)
   - **Google**: Get API key from [Google AI Studio](https://aistudio.google.com/)
4. **LM Studio users**: The Ollama provider works with LM Studio's OpenAI-compatible server

### 3. Start Writing
1. **Open any document** in Obsidian
2. **Click the Nova star** ⭐ in the sidebar
3. **Ask for help**: "Add an introduction explaining why this topic matters"
4. **Watch Nova edit directly** in your document - no copy-paste needed, no learning curve, just natural writing assistance that feels like Obsidian magic

### 4. Pro Tips
- **Switch providers mid-conversation**: Type `:claude` or `:gemini` to change AI models
- **Add document context**: "Edit this section using ideas from [[My Research Notes]]"
- **Use natural language**: "Make this sound more professional but keep it concise"

## 🎭 Usage Examples

### Academic Writing
```
You: "Add a literature review section for renewable energy economics"
Nova: *Creates structured academic section with proper formatting*

You: ":claude Improve the methodology to be more rigorous"
Nova: *Switches to Claude and enhances the methodology section*
```

### Creative Writing
```
You: "Develop this character's backstory with childhood trauma"
Nova: *Adds character development that fits your narrative*

You: "Create dialogue that shows tension between these characters"
Nova: *Generates compelling dialogue directly in your document*
```

### Technical Documentation
```
You: "Add error handling documentation for this API endpoint"
Nova: *Creates comprehensive error docs with examples*

You: "Include code examples using context from [[API Guidelines]]"
Nova: *References your guidelines and adds appropriate code samples*
```

## 🌟 Supernova Supporters

Nova is free forever with your API keys. If you find it valuable, consider becoming a **Supernova Supporter** to help sustain development and get early access to new features.

### What Supernova Supporters Get
- **⚡ Custom Commands** - Create personalized shortcuts (currently in early access)
- **🔮 Early Access** - Try new features 2-6 months before general release
- **🎯 Priority Support** - Get help faster when you need it
- **🗳️ Feature Voting** - Influence development priorities
- **💝 Gratitude** - Know you're supporting sustainable open-source development

### Upcoming Supernova Features
- **Drag-and-Drop Context** - Drag files directly into conversation context
- **Prompt Templates** - Curated templates for different writing types
- **Batch Operations** - Apply edits across multiple documents
- **Advanced Context Controls** - Fine-tuned document context management

**[Become a Supernova Supporter →](https://novawriter.ai/supernova)**

## 🔒 Privacy & Security

**Your Data, Your Choice**:
- **Local AI**: Use Ollama for complete privacy - nothing leaves your device
- **Cloud AI**: Use your own API keys - Nova never sees your content
- **No Analytics**: Nova doesn't track your usage or collect data
- **Transparent**: Open-source under AGPL-3.0 license

**Privacy Indicators**:
- Clear visual status indicators show whether you're using local or cloud AI
- Sidebar header displays current provider type and name
- No data transmission without explicit user action

## 🛠️ Requirements

- **Obsidian**: v1.0.0 or newer
- **AI Provider**: 
  - **Desktop**: Nova ships with Ollama as the default (no API key required for complete privacy)
  - **Mobile**: Requires a cloud provider API key (Claude, OpenAI, or Google) - local AI not available on mobile
- **Platform**: Windows, macOS, Linux, iOS, Android

**For privacy-conscious users**: Nova defaults to Ollama for local AI that never leaves your device. The Ollama provider also works with LM Studio and other OpenAI-compatible local servers.

**For mobile users**: You'll need at least one cloud provider API key since local AI models cannot run on mobile devices.

## 📖 Documentation

- **[Setup Guide](https://docs.novawriter.ai/setup)** - Complete installation and configuration
- **[User Guide](https://docs.novawriter.ai/guide)** - How to get the most out of Nova
- **[API Providers](https://docs.novawriter.ai/providers)** - Comparison and setup for each provider
- **[Troubleshooting](https://docs.novawriter.ai/troubleshooting)** - Common issues and solutions

## 🤝 Contributing

Nova is open-source and welcomes contributions! See our [Contributing Guide](./CONTRIBUTING.md) for details.

**Ways to contribute**:
- 🐛 Report bugs and suggest improvements
- 🔧 Submit pull requests (CLA required)
- 📖 Improve documentation
- 🧪 Test on different platforms
- ⭐ Star the repository to show support

## 📄 License

Nova is licensed under **GNU Affero General Public License v3.0** (AGPL-3.0).

**What this means**:
- ✅ **Free to use** for any purpose (personal, commercial, non-profit)
- ✅ **Free to modify** and customize for your needs  
- ✅ **Free to distribute** (with source code)
- ✅ **Improvements must be shared** back with the community
- ✅ **No hidden restrictions** or commercial traps

This license ensures Nova remains free and open while protecting against closed-source commercial exploitation. It aligns with the Obsidian community's values of transparency and user freedom.

See [LICENSE.md](./LICENSE.md) for full details.

## 🆘 Support

- **🐛 Bug Reports**: [GitHub Issues](https://github.com/shawnduggan/nova-obsidian/issues)
- **💬 Community**: [GitHub Discussions](https://github.com/shawnduggan/nova-obsidian/discussions)
- **📧 Supernova Support**: priority@novawriter.ai (supporters only)
- **📚 Documentation**: [docs.novawriter.ai](https://docs.novawriter.ai)

## 🚀 What's Next

Nova is actively developed with new features added regularly. Follow [GitHub Issues](https://github.com/shawnduggan/nova-obsidian/issues) for development updates.

**Coming Soon** (for Supernova Supporters first):
- Enhanced drag-and-drop workflow
- Professional prompt template library  
- Multi-document batch operations
- Advanced conversation management

---

**Ready to transform your writing workflow?** [Install Nova today →](https://obsidian.md/plugins?id=nova)

*Built with ❤️ in Halifax NS 🇨🇦*
