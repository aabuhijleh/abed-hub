/** `npm stage publish` in the current directory, with the trusted-publisher fix on an auth failure. */
import { explainStageFailure } from "./lib/trust";

const pkg = process.argv[2];
if (!pkg) throw new Error("usage: stage.ts <package-name>");

const proc = Bun.spawn(["npm", "stage", "publish"], {
  stdout: "pipe",
  stderr: "pipe",
});
const [out, err] = await Promise.all([
  new Response(proc.stdout).text(),
  new Response(proc.stderr).text(),
]);
process.stdout.write(out);
process.stderr.write(err);

const code = await proc.exited;
if (code !== 0) {
  const hint = explainStageFailure(
    `${out}\n${err}`,
    pkg,
    process.env.GITHUB_RUN_ID,
  );
  if (hint)
    console.log(`::error title=${pkg} has no trusted publisher::${hint}`);
}
process.exit(code);
