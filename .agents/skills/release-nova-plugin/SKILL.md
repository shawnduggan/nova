---
name: release-nova-plugin
description: Run Nova's approval-gated version, release-note, build, commit, tag, push, GitHub release, asset, and attestation workflow. Use only when the user explicitly asks to prepare or publish a Nova release.
---

# Release Nova Plugin

This workflow has irreversible Git and publication steps. Require explicit
authorization at each gate. A request to prepare a release does not by itself
authorize commits, tags, pushes, or publication.

Nova release tags and titles use the bare version number without a v prefix.
The approved release-note body is the single source for both in-app notes and
the GitHub release.

## Gate 0: Resolve the Release

- Require an explicit target version or semantic bump. Ask if it is missing.
- Identify the active release branch and intended publication branch. Do not
  merge, rebase, or sync with origin/main unless explicitly requested.
- Verify the target version is greater than the current version and does not
  already exist as a local tag, remote tag, or GitHub release.
- Inspect git status, staged changes, untracked files, and remote configuration.
- Verify `.github/workflows/release-attestation.yml` is committed and enabled
  on the default branch, retains both `release: published` and
  `workflow_dispatch`, and can run before relying on post-release attestation.
- Require a clean worktree before beginning. Never discard unrelated changes
  to make it clean.

If the expected publication branch is main but the active release is
elsewhere, stop and ask for direction rather than moving commits implicitly.

## Gate 1: Preflight

From the clean release state, run:

- npm run build:prod
- npm test
- npm run lint
- npm run lint:security
- npm run lint:obsidian

Confirm the commands leave the intended tracked state clean. Stop on any
failure or unexplained generated diff. Do not weaken checks or proceed with a
known blocking failure.

## Gate 2: Draft and Approve Release Notes

1. Find the newest SemVer release tag reachable from the verified release
   head and inspect every commit from that tag to the release head. Do not use
   an unrelated tag from another branch as the notes baseline.
2. Draft concise user-facing notes in the established
   src/release-notes.ts style.
3. Include only verified shipped changes. Exclude internal churn unless it has
   user-facing impact.
4. Show the complete exact body that will appear in both locations.
5. Obtain explicit approval of that exact body. If revised, show the complete
   replacement and obtain approval again.

Before this approval, do not edit release notes, bump versions, commit, tag,
push, or create a release.

## Gate 3: Update and Commit In-App Notes

After body approval:

1. Show a unified PATCH PREVIEW for src/release-notes.ts.
2. Add the approved version entry and keep only the five most recent entries.
3. Verify the stored body matches the approved body exactly.
4. Run the focused tests and build that cover release-note parsing and display.
5. Show git status and the exact diff.
6. Propose `docs(release-notes): add notes for <version>` and wait for explicit
   commit approval.
7. Commit only the approved release-notes change.

## Gate 4: Bump, Verify, and Commit the Version

Start from the clean release-notes commit.

1. Create a fresh detached temporary worktree at the verified release-notes
   commit.
2. In that worktree, run the exact
   npm version <bump-or-version> --no-git-tag-version command. Never use npm
   version without --no-git-tag-version because automatic commits and tags are
   prohibited.
3. Inspect the temporary worktree's index and worktree, verify the expected
   files, show the complete unified diff as the version PATCH PREVIEW, and
   obtain explicit approval to apply it.
4. Remove only that known temporary worktree after recording the preview.
5. Run the identical version command in the release worktree. Stop unless its
   resulting index and worktree match the approved preview exactly.
6. Allow the repository version lifecycle to update package.json,
   package-lock.json, manifest.json, and versions.json as configured. It may
   stage lifecycle outputs; inspect both the index and worktree.
7. Verify all version values and versions.json compatibility entries.
8. Run npm run build:prod, npm test, npm run lint, npm run lint:security, and
   npm run lint:obsidian.
9. Inspect the release assets and complete diff. Stop on unexpected files or
   failures.
10. Propose the exact version commit and wait for explicit commit approval.
11. Commit only the verified version and required generated changes.

No tag has been created yet.

## Gate 5: Approve Tag, Push, and Publication

Present:

- release commit hash;
- exact bare version tag, tag type, and tag command;
- source branch and remote;
- commits to be pushed;
- approved release-note body;
- release asset list: main.js, manifest.json, and styles.css;
- attestation workflow readiness;
- relevant check results.

Obtain explicit approval naming the tag, push target, and GitHub release. The
user may approve these related actions together only after seeing this exact
summary.

After approval:

1. Immediately revalidate clean status, unchanged HEAD, absent local and
   remote tag, absent GitHub release, and a non-force push target. Stop on any
   state drift.
2. Create the approved tag type on the verified release commit. Infer the
   repository standard from reachable successful release tags; if history is
   mixed, resolve the exact type with the user before approval.
3. Push only the approved branch and tag to the approved remote.
4. Create the GitHub release with the bare version as title and tag, the exact
   approved notes, and main.js, manifest.json, and styles.css as assets.
5. Confirm package.json and manifest.json use the exact target version, the tag
   equals manifest.json's version, the release points to the intended commit,
   and all three assets are present.

Never force-push, move a tag, overwrite a release, or delete release state
without separate explicit authorization.

## Gate 6: Verify Assets and Attestations

1. Wait for the Attest release assets workflow to finish and require success.
2. Download the published assets into a fresh temporary directory.
3. Compare each published asset byte-for-byte with the verified local
   main.js, manifest.json, and styles.css.
4. Under the current workflow, run gh attestation verify for main.js and
   styles.css against the Nova repository identity. If the workflow later
   attests additional assets, verify every asset it lists.
5. Record the release URL, tag, commit, workflow result, asset hashes or byte
   comparison, and attestation result.

The release is complete only after these checks pass.

## Failure Handling

Stop at the first failed gate and report the exact partial state and safest
next action. Do not automatically roll back commits, tags, pushes, releases,
or assets. Any destructive recovery requires new explicit authorization.
