# Pi Workspaces

Independent Git workspaces and session navigation for [Pi](https://pi.dev), powered by [Rift](https://github.com/anomalyco/rift).
Create isolated repository copies, work in parallel, and merge changes back without losing your conversation.
Inspired by [OpenCode's workspace workflow](https://github.com/anomalyco/opencode).

## Installation

```sh
pi install npm:@rentezzy/pi-workspaces
```

Requires **Pi**, **[Rift](https://github.com/anomalyco/rift)** on `PATH`, and a Git repository with at least one commit.
Linked worktrees, sparse checkouts, and submodules are unsupported.

## Commands

Run these inside Pi:

| Command                       | Purpose                                                    |
| ----------------------------- | ---------------------------------------------------------- |
| `/workspace`                  | Open the workspace menu.                                   |
| `/workspace create [name]`    | Create a copy; omit the name to generate one.              |
| `/workspace list`             | Browse project workspaces.                                 |
| `/workspace merge SOURCE`     | Merge into the current workspace.                          |
| `/workspace delete WORKSPACE` | Remove a workspace.                                        |
| `/workspace configure`        | Edit project or profile defaults.                          |
| `/workspace help`             | Show all options.                                          |
| `/neww`                       | Start a fresh conversation in a new or existing workspace. |
| `/res`                        | Resume conversations across workspaces.                    |

## Agent tools

| Tool                  | Purpose                                       |
| --------------------- | --------------------------------------------- |
| `workspace_create`    | Create an independent repository copy.        |
| `workspace_list`      | List workspaces, branches, and local changes. |
| `workspace_merge`     | Integrate changes into a target workspace.    |
| `workspace_delete`    | Delete a copy.                                |
| `workspace_configure` | Read or update project/profile settings.      |

Workspace selectors accept names, IDs, or paths. Tools manage repositories and configuration;
session navigation is interactive. Recorded sessions must be removed before deleting their workspace.

## Configuration

Copies live in `~/.worktrees` by default. Use `/workspace configure` to set the storage root,
creation strategy, base branch, exclusions, and lifecycle hooks. Trusted project settings in
`.pi/workspaces.json` override the profile's `workspaces.json`. Use `--no-hooks` to skip hooks for an operation.

## License

[MIT](LICENSE) © 2026 rentezzy.
