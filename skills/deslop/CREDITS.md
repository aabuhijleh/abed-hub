# Credits

`deslop` is a copy of [`unslop`](https://github.com/cursor/plugins/blob/main/pstack/skills/unslop/SKILL.md)
by [Lauren Tan](https://github.com/poteto), from Cursor's pstack plugin, taken at commit
[`70b2dc8`](https://github.com/cursor/plugins/blob/70b2dc8b4b85c8d5648624ca40d692c421fff32f/pstack/skills/unslop/SKILL.md).

The body is unslop's, word for word, apart from the title. The rule numbers stay as they
are, since other skills cite them. `bun run skills:sync` pulls upstream's latest body and
repins the commit above. The title change is a patch in `scripts/lib/forks.ts`. Three things
changed, all in the frontmatter:

- The name is `deslop`, so it can sit next to an installed `unslop` without one
  overwriting the other.
- The description names what it applies to: PR titles and bodies, Slack and Jira posts,
  READMEs and other human docs. It leaves out agent answers, so it doesn't fire on every
  reply. It also leaves the fixed headings and bold labels of the `pr` skill and of PR
  templates alone. Upstream's description fires on any writing.
- An agent can invoke it. Upstream sets `disable-model-invocation: true`, which stops one
  skill from calling another.

unslop is under the MIT license, and this copy keeps its notice:

```
MIT License

Copyright (c) 2026 Lauren Tan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
