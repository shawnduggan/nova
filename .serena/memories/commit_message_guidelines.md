# Commit Message Guidelines for Nova

## Strict Rules
- ❌ **NEVER mention Claude in commit messages**
- ❌ **NO "Generated with Claude Code" attribution**
- ❌ **NO "Co-Authored-By: Claude" lines**

## Format
- Use clean, descriptive commit messages
- Focus on what was changed and why
- Follow conventional commit format when appropriate
- Keep messages concise but informative

## Example Good Commit:
```
Fix security vulnerabilities in settings persistence

- Prevent debugSettings from being saved to data.json
- Encrypt license keys using existing CryptoService
- Ensure sensitive data is encrypted at rest
```

## Example Bad Commit:
```
Fix settings issues

🤖 Generated with [Claude Code](https://claude.ai/code)
Co-Authored-By: Claude <noreply@anthropic.com>
```

## Reminder
This is a STRICT requirement from CLAUDE.md - any violation shows failure to follow project guidelines.