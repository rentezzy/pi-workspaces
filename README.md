# Pi Workspaces

Independent Git copies and session navigation for Pi, backed by Rift.

## Installation

```sh
pi install npm:@rentezzy/pi-workspaces
```

For local development, load this checkout without changing Pi's configuration:

```sh
pi --extension ./index.ts
```

Requires Pi, Rift on `PATH`, compatible CoW storage, and a committed independent
Git repository. Pi provides the runtime dependencies; Bun is only needed for
package development and publishing.

## Development and publishing

```sh
bun install
bun run check        # oxlint, oxfmt check, and TypeScript
bun run lint:fix
bun run format
```

With a clean, committed working tree and npm authentication configured, run:

```sh
bun run publish
```

This checks the package, bumps the patch version, commits the version change,
creates a `v<VERSION>` Git tag, then publishes to npm with public access. It does
not push the commit or tag. `--ignore-scripts` on the inner `bun publish` prevents
it from invoking the `publish` script recursively.

Preview the npm contents without changing the version or publishing:

```sh
npm pack --dry-run --ignore-scripts
```

## Usage

Code is grouped into `workspaces/`, `git/`, `sessions/`, `config/`, `ui/`,
`commands/`, and `tools/`. Common I/O and utilities live in `shared/`;
each domain keeps its contracts in `types.ts` and static values in `constants.ts`.

- `/workspace`: create, list, configure, merge, delete, or **Switch to**.
- `/neww`: fresh conversation in a new or existing workspace.
- `/res`: project-wide resume, grouped by workspace by default. Tab switches
  Workspaces/Sessions; Ctrl+P switches Project/All; Shift+Tab shows transfer history.

**Switch to** continues the conversation without merging files. Transfer parents
stay on disk. Native `/new` and `/resume` are unchanged. Recorded session files
inside a workspace prevent its deletion.

```text
/workspace create
/workspace create review --strategy branch --ref origin/main
/workspace merge review --into here --mode passive
/workspace delete review
/workspace configure
```

Agent tools: `workspace_create`, `workspace_delete`, `workspace_list`,
`workspace_merge`, `workspace_configure`. Creation names are generated when omitted;
selectors accept names, IDs, and paths. Navigation is human-only.

Configure project/profile defaults through the menu or `workspace_configure`.
Trusted origin `.pi/workspaces.json` overrides profile `workspaces.json` for all copies:

```json
{
  "root": "~/.worktrees",
  "defaultStrategy": "local",
  "baseBranch": "main",
  "hooks": { "postCreate": ["bun install"] }
}
```

Copies respect Git ignores and artifact exclusions; `exclude` replaces the latter.
`transferNotice` controls new hidden model-visible transfer notices (default true).
Hooks: `preCreate`, `postCreate`, `preDelete`, `postDelete`, `preMerge`, `postMerge`;
`--no-hooks` skips them.

Merges import all local branches: fast-forward where possible, otherwise rebase
incoming commits. Active selects the source branch; passive keeps the destination
branch. Local edits remain uncommitted; text conflicts retain markers. For private
rebase conflicts, resolve and stage in the returned integration directory, then
`/workspace merge SOURCE --resume OPERATION` with the original `--into`, if supplied.

Requires Rift, compatible CoW storage, and a committed independent Git repository.
Linked worktrees, sparse checkouts, and submodules are unsupported. Catalog and
recovery data live in the profile's `workspaces/` directory.
