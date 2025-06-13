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
- **Provider Switching**: Switch AI models using the provider dropdown

### 🎯 Smart Writing Features
- **Multi-Document Context**: Reference other notes with `[[Document Name]]` syntax - uses Obsidian's native autocomplete with document suggestions
- **File-Scoped Conversations**: Each document maintains its own chat history
- **Auto-Growing Input**: Smart input area that expands as you type
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
- **Switch providers**: Use the provider dropdown to change AI models
- **Add document context**: "Edit this section using ideas from [[My Research Notes]]"
- **Use natural language**: "Make this sound more professional but keep it concise"

## 🎭 Usage Examples

### Academic Writing
```
You: "Add a literature review section for renewable energy economics"
Nova: *Creates structured academic section with proper formatting*

You: *Switch to Claude via provider dropdown* "Improve the methodology to be more rigorous"
Nova: *Enhances the methodology section with Claude's analysis*
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
- **🎯 Priority Support** - Get help faster when you need it
- **🗳️ Feature Voting** - Influence development priorities
- **⚡ Early Access** - Try new features 2-6 months before general release
- **💝 Gratitude** - Know you're supporting sustainable open-source development

### Upcoming Supernova Features (Early Access)

**⚡ Rapid Command System** *(Coming July 2025)*
- Lightning-fast workflow acceleration with intuitive shortcuts
- Context-aware automation that learns your writing patterns
- Advanced keyboard-driven editing for power users

**🎯 Contextual Text Intelligence** *(Coming August 2025)*
- Adaptive text refinement with precision targeting
- Intelligent content adjustment based on selection context
- Professional-grade text transformation tools

**📊 Clarity Optimization Engine** *(Coming September 2025)*
- Advanced readability analysis and enhancement
- Multi-level writing complexity management
- Audience-aware content optimization

**🔧 Local AI Orchestration** *(Coming October 2025)*
- Intelligent model management for local AI workflows
- Seamless switching between local AI configurations
- Performance optimization for offline writing

**🗂️ Multi-Document Intelligence** *(Coming November 2025)*
- Cross-document context analysis and editing
- Batch operations across your entire knowledge base
- Advanced vault-wide content management

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

### Why AGPL-3.0?

I chose AGPL-3.0 because it aligns perfectly with the Obsidian community's values while protecting Nova's open-source future:

- **Complete freedom**: Use Nova for any purpose (personal, commercial, non-profit)
- **Community protection**: Any improvements must be shared back with everyone
- **No exploitation**: Prevents closed-source commercial forks that exploit our work
- **Transparency**: Just like Obsidian respects your data ownership, Nova respects your right to inspect and modify the code
- **Local-first alignment**: Supports the same philosophy that brought you to Obsidian

**What this means for you**:
- ✅ **Free to use** for any purpose (personal, commercial, non-profit)
- ✅ **Free to modify** and customize for your needs  
- ✅ **Free to distribute** (with source code)
- ✅ **Improvements must be shared** back with the community
- ✅ **No hidden restrictions** or commercial traps

**Commercial Use**: Nova is completely free for all uses, including enterprise environments. If you need additional licensing options for your organization, feel free to reach out.

This license ensures Nova remains free and open while protecting against closed-source commercial exploitation that would undermine the community's contributions.

See [LICENSE.md](./LICENSE.md) for full details.

## 🆘 Support

- **🐛 Bug Reports**: [GitHub Issues](https://github.com/shawnduggan/nova-obsidian/issues)
- **💬 Community**: [GitHub Discussions](https://github.com/shawnduggan/nova-obsidian/discussions)
- **📧 Supernova Support**: priority@novawriter.ai (supporters only)
- **📚 Documentation**: [docs.novawriter.ai](https://docs.novawriter.ai)

## 🚀 What's Next

Nova is actively developed with new features added regularly. Supernova supporters get early access to upcoming features, while all features eventually become available to everyone.

Follow [GitHub Issues](https://github.com/shawnduggan/nova-obsidian/issues) for development updates and community discussions.

---

**Ready to transform your writing workflow?** [Install Nova today →](https://obsidian.md/plugins?id=nova)

**Crafted with ❤️ in Halifax NS 🇨🇦**
