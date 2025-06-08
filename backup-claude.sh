#!/bin/bash
# backup-claude.sh
# Run this after each Claude Code session

BACKUP_DIR="$HOME/Documents/nova-backups"
mkdir -p "$BACKUP_DIR"

# Create timestamped backup
cp CLAUDE.md "$BACKUP_DIR/CLAUDE-$(date +%Y%m%d-%H%M%S).md"

# Keep last 10 backups
ls -t "$BACKUP_DIR"/CLAUDE-*.md | tail -n +11 | xargs -r rm

echo "✅ CLAUDE.md backed up to $BACKUP_DIR"