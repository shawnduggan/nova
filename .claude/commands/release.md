Automate the release workflow: version bump, tag, push, and GitHub release.

## Process

1. **Verify clean state**
   ```bash
   npm run build:prod
   npm test
   git status
   ```
   Abort if build fails, tests fail, or uncommitted changes exist.

2. **Draft and preview release notes**
   - Determine the upcoming version (read current from package.json, apply bump type)
   - Review `git log` since last tag to build the changelog
   - Draft the exact user-friendly markdown body that will appear both in-app and on GitHub
   - Present the complete body to the user and wait for explicit approval
   - If revised, preview the complete revised body and obtain approval again
   - Do not edit release notes, commit, bump, tag, push, or create a GitHub release before approval

3. **Write approved release notes**
   - Add an entry to `RELEASE_NOTES` in `src/release-notes.ts` for the new version
   - Format: user-friendly markdown — this content is shown both in-app (Obsidian tab) and on GitHub
   - Prune old entries if more than 5 exist
   - Commit: `docs(release-notes): add notes for [VERSION]`
   - Run `npm run build` to verify the change compiles

4. **Bump version**
   ```bash
   npm version patch
   ```
   This updates package.json, runs version-bump.mjs (updates manifest.json + versions.json), and auto-commits.

5. **Get new version**
   Extract version from package.json for subsequent steps.

6. **Production build**
   ```bash
   npm run build:prod
   ```
   This ensures main.js is production-optimized before attaching to the release.

7. **Push with tags**
   ```bash
   git push origin main --tags
   ```

8. **Create GitHub release**
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
