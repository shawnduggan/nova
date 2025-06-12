# Contributing to Nova

Thank you for your interest in contributing to Nova! This document outlines the process for contributing to the project.

## Before You Start

Nova is an open-source passion project aimed at making AI-assisted writing more seamless in Obsidian. We welcome contributions that align with our core philosophy: direct document collaboration, privacy-first design, and community-driven development.

## Contributor License Agreement (CLA)

**Important**: All contributors must sign a Contributor License Agreement before we can accept your contributions.

### Why Do We Require a CLA?

The CLA ensures that:
- You grant Nova the necessary rights to use your contributions
- Nova maintains the flexibility to adapt licensing if needed (e.g., offering commercial licenses to enterprises)
- The project can be maintained and evolved sustainably
- Your contributions remain properly attributed

### How to Sign the CLA

Before submitting your first pull request, please:

1. **Download the CLA**: [Nova-CLA.pdf](https://github.com/shawnduggan/nova-obsidian/blob/main/Nova-CLA.pdf)
2. **Fill out your information** (name, email, date)
3. **Email the signed CLA** to: contrib@novawriter.ai
4. **Include the PR number** you plan to submit in the email subject

We'll confirm receipt and add you to our contributors list.

## Types of Contributions

We welcome several types of contributions:

### 🐛 Bug Reports
- Use the [Bug Report Template](./BUG_REPORT_TEMPLATE.md)
- Include clear reproduction steps
- Specify your platform and Obsidian version
- Check existing issues to avoid duplicates

### 🔧 Bug Fixes
- Reference the issue number in your PR
- Include tests for your fix if applicable
- Keep changes focused and atomic

### ✨ Feature Requests
- Open an issue first to discuss the feature
- Explain the use case and expected behavior
- Consider if it aligns with Nova's core philosophy

### 📖 Documentation
- Fix typos, improve clarity, add examples
- Update documentation when adding features
- Translate documentation (contact us first)

### 🧪 Testing
- Add test cases for existing functionality
- Improve test coverage
- Report testing results on different platforms

## Development Guidelines

### Code Style

- **TypeScript**: Follow strict TypeScript practices
- **Formatting**: Use the project's ESLint configuration
- **Naming**: Use clear, descriptive variable and function names
- **Comments**: Document complex logic and public APIs

### Architecture Principles

- **Simplicity**: Prefer straightforward solutions over complex ones
- **Obsidian Integration**: Use Obsidian's native APIs and design patterns
- **Privacy First**: Never transmit data without explicit user consent
- **Performance**: Don't block the main thread, optimize for mobile

### Testing

- **Write Tests**: Include tests for new functionality
- **Run Tests**: Ensure all tests pass before submitting
- **Manual Testing**: Test your changes on multiple platforms

### Commit Messages

- Use clear, descriptive commit messages
- Reference issue numbers when applicable
- Keep commits focused on a single change

Example:
```
Fix provider switching context preservation (#123)

- Preserve conversation context when switching between providers
- Add tests for context preservation
- Update documentation for provider switching
```

## Pull Request Process

1. **Fork the repository** and create a feature branch
2. **Sign the CLA** (required for first-time contributors)
3. **Make your changes** following our guidelines
4. **Add tests** for new functionality
5. **Update documentation** if necessary
6. **Run the full test suite** and ensure all tests pass
7. **Submit a pull request** with a clear description

### PR Requirements

- [ ] CLA signed (for first-time contributors)
- [ ] All tests passing
- [ ] Documentation updated if needed
- [ ] Code follows project style guidelines
- [ ] Commit messages are clear and descriptive
- [ ] PR description explains the changes and rationale

## Feature Development Priorities

Nova follows a community-supported model:

- **Core Features**: All essential functionality remains free forever with user API keys
- **Supernova Early Access**: New features are available to supporters 2-6 months before general release
- **Community-Driven**: Feature priorities are influenced by supporter feedback and community needs

For the current list of features and their availability, see the [README.md](./README.md).

## Community

### Getting Help

- **GitHub Issues**: For bug reports and feature requests
- **Discussions**: For general questions and community chat
- **Email**: contrib@novawriter.ai for CLA and contribution questions

### Code of Conduct

Nova follows a simple principle: **Be respectful and constructive**. We're all here to make writing with AI better for everyone.

- Treat others with respect and kindness
- Focus on the work, not the person
- Provide constructive feedback
- Help newcomers learn and contribute

## Recognition

Contributors are recognized in several ways:

- **Contributors file**: Listed in CONTRIBUTORS.md
- **Release notes**: Major contributors mentioned in releases
- **Special recognition**: Outstanding contributors may receive Supernova supporter status

## License

By contributing to Nova, you agree that your contributions will be licensed under the GNU Affero General Public License v3.0, and you grant Nova the rights specified in the Contributor License Agreement.

---

**Questions?** Feel free to open a discussion or email contrib@novawriter.ai. We're here to help make contributing as smooth as possible!

Thank you for helping make Nova better! ⭐
