# trackboi

No bullshit kanban for agents and people.

trackboi is a local-first desktop kanban app with an MCP server built in. It is 100% local and git based: your boards, cards, tracks, notes, and agent handoffs live on disk beside the work instead of disappearing into somebody else's SaaS.

## Why

- Plan work with people and agents in the same place.
- Keep task state in the repo, close to the code.
- Use trackboi as a desktop app, a CLI, or an MCP server for agent workflows.
- Own the files. Move them, diff them, back them up, commit them.

## Install

Download the latest release artifact for your OS from GitHub Releases.

- Linux: AppImage, RPM, or DEB
- macOS: DMG or ZIP
- Windows: NSIS installer or ZIP

The first public builds are unsigned, so macOS and Windows may show trust warnings.

## Development

trackboi uses Bun, Vue, Electron, and electron-builder.

```bash
bun install
bun run dev
```

Run checks and tests:

```bash
bun run check
bun test
```

Build local packages:

```bash
bun run dist:linux
bun run dist:mac
bun run dist:win
```

Platform packages are written to `release/`.

## MCP

Run the local MCP server:

```bash
bun run mcp
```

trackboi's MCP tools use the same local project state as the desktop app, so agents can create cards, update tracks, write notes, and leave handoffs without a remote service.

## License

MIT
