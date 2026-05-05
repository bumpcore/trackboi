# trackboi usage guide

trackboi is local kanban for agents and people. It stores app settings in `~/.trackboi/config.json` and project data in the repo, normally under `.trackboi`.

## Product terms

- Workspace: a repo or folder registered in the desktop app.
- Worktree: a discovered git worktree for a workspace.
- Project: the per-worktree identity and settings.
- Board: a project board with columns and cards.
- Track: durable context for an ongoing workstream.
- Card: an executable task on a board.

## Storage

New repos use `.trackboi` by default:

```text
.trackboi/
  project.json
  boards/
  cards/
  tracks/
```

Existing `.etc/.trackboi` and `.etc/trackboi` stores are still discovered for compatibility. If a repo has an existing legacy store, trackboi keeps using it instead of creating a second database.

Global app settings live at:

```text
~/.trackboi/config.json
```

That file remembers registered workspaces, selected board/worktree, user identity, agent identities, editor preference, and shortcuts.

## Desktop setup

1. Open trackboi.
2. Add a repo or folder.
3. Complete onboarding with your display name and git identity.
4. Add an agent identity if you want MCP tools to attribute changes consistently.

The desktop app can open card files in your configured editor. Set this in Settings -> Editor.

## MCP setup

trackboi exposes the same core actions through an MCP server:

```bash
trackboi mcp
```

For local development from this repo:

```bash
bun --cwd /home/abdulkadir/projects/trackboi src/cli/entry.ts mcp
```

### Codex or repo-local MCP

Add a repo-local `.mcp.json`:

```json
{
  "mcpServers": {
    "trackboi": {
      "command": "trackboi",
      "args": ["mcp"]
    }
  }
}
```

The CLI can install this plus agent guidance:

```bash
trackboi install --all
```

### Claude Desktop

Add the server to your Claude Desktop MCP config:

```json
{
  "mcpServers": {
    "trackboi": {
      "command": "trackboi",
      "args": ["mcp"]
    }
  }
}
```

Restart Claude Desktop after editing the config.

### Cursor and Windsurf style clients

Use the same MCP server shape in the client's MCP settings:

```json
{
  "trackboi": {
    "command": "trackboi",
    "args": ["mcp"]
  }
}
```

Some clients expect the object under `mcpServers`, while others expect a flat server map. The command and args stay the same.

## Agent workflow

Agents should start by reading the active context, then choose the correct project/worktree/board before mutating cards or tracks. Mutations require an active agent identity so future handoffs show who changed what.

Useful MCP actions include:

- `get_active_context`
- `list_boards`
- `list_cards`
- `create_card`
- `move_card`
- `add_card_comment`
- `create_track`
- `write_track_file`
- `get_app_settings`
- `register_agent`

Keep updates short and factual. Use tracks for durable decisions and references, and cards for executable work.
