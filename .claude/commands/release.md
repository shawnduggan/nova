Automate the release workflow: version bump, tag, push, and GitHub release.

## Process

1. **Verify clean state**
   ```bash
   npm run build:prod
   npm test
   git status
   ```
   Abort if build fails, tests fail, or uncommitted changes exist.

2. **Write release notes**
   - Determine the upcoming version (read current from package.json, apply bump type)
   - Review `git log` since last tag to build the changelog
   - Add an entry to `RELEASE_NOTES` in `src/release-notes.ts` for the new version
   - Format: user-friendly markdown — this content is shown both in-app (Obsidian tab) and on GitHub
   - Prune old entries if more than 5 exist
   - Commit: `docs(release-notes): add notes for [VERSION]`
   - Run `npm run build` to verify the change compiles

3. **Bump version**
   ```bash
   npm version patch
   ```
   This updates package.json, runs version-bump.mjs (updates manifest.json + versions.json), and auto-commits.

4. **Get new version**
   Extract version from package.json for subsequent steps.

5. **Production build**
   ```bash
   npm run build:prod
   ```
   This ensures main.js is production-optimized before attaching to the release.

6. **Push with tags**
   ```bash
   git push origin main --tags
   ```

7. **Create GitHub release**
   Use the same release notes content from `src/release-notes.ts` (the entry written in step 2) as the `--notes` body:
   ```bash
   gh release create [VERSION] main.js manifest.json styles.css \
     --title "[VERSION]" --notes "[RELEASE_NOTES content for VERSION]"
   ```

## Important

- **No `v` prefix on tags or release titles.** Obsidian's store and release process breaks with `v`-prefixed tags. Tags must be bare version numbers (e.g. `1.1.2`, not `v1.1.2`).
- Release notes are single-sourced: `src/release-notes.ts` feeds both the in-app page and the GitHub release
- Verify all quality gates pass before releasing
- Review git log since last tag for changelog items
- Include main.js, manifest.json, styles.css in release assets
