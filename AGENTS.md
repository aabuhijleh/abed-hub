# abed-hub agent instructions

Agent skills in `skills/`, and the bun CLIs they drive in `packages/`. Layout, releases and
commit format are in [CONTRIBUTING.md](CONTRIBUTING.md). `CLAUDE.md` is a symlink to this
file.

## Keep it generic

Everything here is public and personal. Examples use placeholder names (`acme`,
`ABC-123`, `owner/repo`) and never an employer, team, customer, or internal host.

## Before you finish

Run `bun run verify`, which CI also runs. Code changes get a test next to the module they
change (`*.test.ts`).

## Writing

- Any `SKILL.md`, or this file: call the Skill tool with `writing-for-agents` first.
- READMEs, CONTRIBUTING, and PR bodies: call the Skill tool with `deslop`. PR bodies follow
  [the template](.github/pull_request_template.md).
- A skill's frontmatter and links follow the rules in
  [`scripts/lib/skills.ts`](scripts/lib/skills.ts), which `verify` checks.
- Third-party skills (`playwright-cli`, `pr`) are installed as upstream ships them, never
  edited. A skill this repo needs changed gets copied into `skills/`, the way `deslop` copies
  Cursor's `unslop`, with the upstream named in `metadata.credits` and a `CREDITS.md` that
  says what changed and carries the license notice.

## Docs sync

A change to a component, skill, command, or flag lands in every one of these in the same
change. Each restates part of the registry by hand:

- `packages/abed-hub/src/lib/registry.ts`: `COMPONENTS`, `SPECS`, and `REMOVED` for a name
  that goes away.
- `README.md`: the skill table, the skill's section and its Setup lines, the Uninstall
  lines.
- `packages/abed-hub/README.md`: the dependency table, Components, Commands.
- `skills/abed-hub/SKILL.md`: its dependency table and what doctor reports.
- `CONTRIBUTING.md`, when a check or a script changes.
