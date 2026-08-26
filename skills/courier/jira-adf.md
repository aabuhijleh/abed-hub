# Writing a Jira description (ADF)

Jira Cloud stores descriptions as **ADF**, which is Atlassian Document Format, a JSON tree. The MCP's
`contentFormat: "markdown"` converts for you, and mangles two things on the way: `- [ ]` becomes
the literal text `\[ \]` instead of a tickable task item, and a bold span containing a backtick
splits mid-sentence. Anything with checkboxes or images is therefore written as ADF, straight at
the REST API, because no CLI command covers it yet.

```
PUT {base}/rest/api/3/issue/{KEY}      {"fields": {"description": <adf doc>}}
```

Credentials live in the file `jira config` names, under its `jira` key: `ATLASSIAN_BASE_URL`,
`ATLASSIAN_USER_EMAIL`, `ATLASSIAN_API_TOKEN` → HTTP Basic. Read them into variables and keep the
token off stdout (`jira config` prints the file *contents*).

## Embedding an image

An image in the body is a `media` node whose `id` Jira validates against the issue's own
attachments, so the file is attached to **that** issue first, and the id is the **Media API file
UUID**, never the numeric attachment id.

1. **Attach and capture the id.** `jira attach <TICKET> <file>… --json` prints each created
   attachment's numeric `id`.
2. **Resolve the UUID.** It appears in no attachment payload, only in the `303` redirect:

   ```
   GET {base}/rest/api/3/attachment/content/{attachmentId}
   → Location: https://api.media.atlassian.com/file/<UUID>/binary?token=…
   ```

3. **Write the node.** `collection` is required and empty; `width`/`height` are the image's pixels.

   ```json
   { "type": "mediaSingle", "attrs": { "layout": "center" },
     "content": [ { "type": "media",
                    "attrs": { "type": "file", "id": "<UUID>", "collection": "",
                               "width": 1647, "height": 258, "alt": "…" } } ] }
   ```

A caption is a following `paragraph`; `mediaSingle` carries none of its own.

## What the errors mean

- `ATTACHMENT_VALIDATION_ERROR`. The media `id` is not a UUID of a file attached to this issue
  (the numeric attachment id lands here).
- `INVALID_INPUT`. The ADF is malformed. Two live causes: `collection` omitted from a `media`
  node, and a `code` mark paired with `strong` or `em` (`code` combines only with `link`).

Both arrive as bare `400`s with an empty `errors` object, so bisect by PUTting a two-node
document, one paragraph plus the node under suspicion, rather than reading the full payload.
