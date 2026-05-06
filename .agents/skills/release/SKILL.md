---
name: release
description: "End-to-end semantic-versioned release workflow for local git repositories and GitHub projects. Use when the user says things like commit, push, release, new version, cut a release, tag and publish, watch CI, fix release assets, or asks Codex to own the release loop: inspect dirty changes, choose/verify the SemVer bump, validate, commit intentionally, push, tag, publish GitHub releases with notes/assets, watch Actions, repair failures, and verify the published result."
---

# Release

Use this skill to finish the release loop, not just prepare a commit. The default target is the current repository and current branch unless the user says otherwise.

## First Checks

Run a quick state read before changing anything:

```bash
git status --short
git branch --show-current
git remote -v
git tag --list --sort=-version:refname | head
```

If the repo uses GitHub, prefer `gh` for remote truth:

```bash
gh repo view --json nameWithOwner,defaultBranchRef,visibility,url
gh run list --limit 10
gh release list --limit 10
```

If the user asked for a specific version, confirm the local version file, existing tags, and existing releases before tagging.

## Choose The Version

Use semantic versioning unless the repo clearly uses another scheme:

- Patch `X.Y.Z+1`: bug fixes, packaging/install fixes, docs-only release cleanup, CI/release workflow fixes, small internal polish.
- Minor `X.Y+1.0`: new backward-compatible features, new public tools/commands, meaningful UI capabilities, new package targets, expanded public API.
- Major `X+1.0.0`: breaking public API/CLI/MCP changes, storage migrations that require user action, removal of supported behavior, incompatible config changes.

When the user says "new version" without a number, infer the smallest valid SemVer bump from the diff and explain the choice briefly. When the user gives a version, verify it matches SemVer and is greater than the latest tag/release before tagging.

Update all repo version sources that users or package builders consume, such as `package.json`, lockfiles when required, app metadata, changelog/release docs, and installer manifests. Do not create an untagged version bump unless the user asks to prepare but not release.

## Scope The Commit

Inspect changes before staging:

```bash
git diff --stat
git diff
```

Commit all changes only when the user explicitly says so. Otherwise stage intentional release files and leave unrelated dirty work alone.

For generated or local-state files, make a conscious call:

- Include them when the user says "commit every change" or they are part of release state.
- Exclude them when they are local board/cache/editor state and the user did not request them.
- Never revert user changes unless they clearly ask.

## Validate Before Push

Use the repo's own checks. Prefer obvious scripts from `package.json`, `justfile`, `Makefile`, Composer, Cargo, etc.

Common examples:

```bash
bun run check
bun test
bun run test:ui
```

If release packaging is part of the task, run the smallest local package check that proves the changed path. Do not spend forever on cross-platform local builds when GitHub Actions owns the matrix.

## Commit And Push

Use a plain release commit message:

```bash
git add <intentional paths>
git commit -m "Release <name> <version>"
git push origin <branch>
```

If validation fails, fix the failure before committing unless the user explicitly asks to commit broken work.

## Tag And Release

For version tags, use `vX.Y.Z` unless the repo clearly uses another format.

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

If a release workflow is tag-triggered, watch the run:

```bash
gh run list --limit 10
gh run watch <run-id> --exit-status
```

If the workflow fails, inspect logs before changing code:

```bash
gh run view <run-id> --log-failed
```

Fix, commit, push, and decide whether to move/recreate the tag based on repo policy. Do not silently force-push tags unless the user already allowed that style.

## Release Notes

Prefer concise notes that say what changed and who should care. Avoid weird jokes or workflow internals unless the user asks.

Good shape:

```text
<project> <version> is a <small/polish/fix/feature> release focused on <theme>.

Highlights:
- ...
- ...

Builds are unsigned for now, so macOS and Windows may show trust warnings.

Full changelog: <compare URL>
```

Use:

```bash
gh release edit <tag> --notes "$NOTES"
```

When no release workflow exists, create the release directly:

```bash
gh release create <tag> --title "<tag>" --notes "$NOTES" <asset paths>
```

## Verify Done

Do not call the release done until remote state is verified:

```bash
git status --short
gh run list --limit 10
gh release view <tag> --json tagName,name,url,isDraft,isPrerelease,assets
```

Check expected assets by name, not just that a release exists. For desktop apps this often means Linux `.deb`/`.rpm`/`.AppImage`, macOS `.dmg`/`.zip`, and Windows `.exe`/`.zip`.

Final response should include:

- commit hash and message
- pushed branch and tag
- validation run locally
- CI/release workflow status
- release URL
- important warnings, such as unsigned builds or skipped checks
