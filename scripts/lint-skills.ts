/** Lints every skills/<name>/SKILL.md; errors exit 1, warnings only print. */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { lintSkill } from "./lib/skills";

const root = path.join(import.meta.dir, "..", "skills");

let errors = 0;
let warnings = 0;

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = path.join(root, entry.name);
  const skill = Bun.file(path.join(dir, "SKILL.md"));
  const result = (await skill.exists())
    ? lintSkill({
        dir: entry.name,
        text: await skill.text(),
        files: await readdir(dir, { recursive: true }),
      })
    : { errors: ["SKILL.md is missing"], warnings: [] };

  for (const message of result.errors)
    console.log(`✖ ${entry.name}: ${message}`);
  for (const message of result.warnings)
    console.log(`▲ ${entry.name}: ${message}`);
  errors += result.errors.length;
  warnings += result.warnings.length;
}

console.log(`\n${errors} errors, ${warnings} warnings`);
if (errors > 0) process.exit(1);
