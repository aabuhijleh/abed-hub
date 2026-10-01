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
- READMEs, CONTRIBUTING, and PR bodies: call the Skill tool with `unslop`. PR bodies follow
  [the template](.github/pull_request_template.md).
- A skill's frontmatter and links follow the rules in
  [`scripts/lib/skills.ts`](scripts/lib/skills.ts), which `verify` checks.
- Third-party skills (`unslop`, `playwright-cli`, `pr`) are installed, never copied here.
  The one change this repo makes to them is the `unslop` frontmatter patch in
  `packages/abed-hub/src/lib/registry.ts`.

## Docs sync

A change to a component, skill, command, or flag lands in every one of these in the same
change. Each restates part of the registry by hand:

- `packages/abed-hub/src/lib/registry.ts`: `COMPONENTS`, `SPECS`, and `REMOVED` for a name
  that goes away.
- `README.md`: the skill table, the skill's section and its Setup lines, the Uninstall
  lines.
- `packages/abed-hub/README.md`: the dependency table, Components, the unslop patch,
  Commands.
- `skills/abed-hub/SKILL.md`: its dependency table and what doctor reports.
- `CONTRIBUTING.md`, when a check or a script changes.
