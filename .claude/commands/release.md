Automate the release workflow: version bump, tag, push, and GitHub release.

## Process

1. **Verify clean state**
   ```bash
   npm run build:prod
   npm test
   git status
   ```
   Abort if build fails, tests fail, or uncommitted changes exist.

2. **Bump version**
   ```bash
   npm version patch
   ```
   This updates package.json, runs version-bump.mjs (updates manifest.json + versions.json), and auto-commits.

3. **Get new version**
   Extract version from package.json for subsequent steps.

4. **Push with tags**
   ```bash
   git push origin main --tags
   ```

5. **Create GitHub release**
   ```bash
   gh release create [VERSION] main.js manifest.json styles.css \
     --title "[VERSION]" --notes "[CHANGELOG]"
   ```

## Release Notes Format

```markdown
## Changes

- [Type]: [Description]
- [Type]: [Description]
```

Types: Add, Fix, Update, Remove, Refactor

## Important

- Verify all quality gates pass before releasing
- Review git log since last tag for changelog items
- Include main.js, manifest.json, styles.css in release assets
