import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { tryCatch } from "../try-catch";

const API_BASE = "https://slack.com/api";

/**
 * Slack Docs, canvases and posts are not uploaded binaries. Their
 * `url_private_download` serves the web app's HTML with a 200 — even with a
 * valid token — so they must be skipped rather than treated as auth failures.
 */
const NATIVE_FILE_MODES = new Set(["docs", "canvas", "space", "post", "email"]);

const fileSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  title: z.string().optional(),
  mimetype: z.string().optional(),
  filetype: z.string().optional(),
  size: z.number().optional(),
  mode: z.string().optional(),
  permalink: z.string().optional(),
  url_private_download: z.string().optional(),
});

const messageSchema = z.object({
  ts: z.string(),
  user: z.string().optional(),
  bot_id: z.string().optional(),
  username: z.string().optional(),
  text: z.string().optional(),
  subtype: z.string().optional(),
  thread_ts: z.string().optional(),
  reply_count: z.number().optional(),
  files: z.array(fileSchema).optional(),
});

const repliesSchema = z.object({
  messages: z.array(messageSchema),
  response_metadata: z
    .object({ next_cursor: z.string().optional() })
    .optional(),
});

const historySchema = repliesSchema;

const authTestSchema = z.object({
  team: z.string(),
  team_id: z.string().optional(),
  user: z.string(),
  user_id: z.string(),
  bot_id: z.string().optional(),
  url: z.string(),
});

const userSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    real_name: z.string().optional(),
    profile: z
      .object({
        real_name: z.string().optional(),
        display_name: z.string().optional(),
      })
      .optional(),
  }),
});

const permalinkSchema = z.object({ permalink: z.string() });

const postMessageSchema = z.object({ channel: z.string(), ts: z.string() });

/** `chat.delete` echoes what it removed; `files.delete` answers with `ok` alone. */
const deleteMessageSchema = z.object({ channel: z.string(), ts: z.string() });
const okSchema = z.object({ ok: z.boolean() });

const uploadUrlSchema = z.object({
  upload_url: z.string(),
  file_id: z.string(),
});

const completeUploadSchema = z.object({
  files: z.array(z.object({ id: z.string(), title: z.string().optional() })),
});

/** `shares` is keyed by visibility, then by channel: `{ private: { C0…: [{ ts }] } }`. */
const fileInfoSchema = z.object({
  file: z.object({
    id: z.string(),
    permalink: z.string().optional(),
    shares: z
      .record(
        z.string(),
        z.record(z.string(), z.array(z.object({ ts: z.string().optional() }))),
      )
      .optional(),
  }),
});

const channelSchema = z.object({
  channel: z.object({
    id: z.string(),
    name: z.string().optional(),
    is_private: z.boolean().optional(),
    is_member: z.boolean().optional(),
    is_archived: z.boolean().optional(),
  }),
});

export type SlackFile = z.infer<typeof fileSchema>;
export type SlackMessage = z.infer<typeof messageSchema>;
export type AuthTest = z.infer<typeof authTestSchema>;

/** Where a post lands: a thread reply when `threadTs` is set, top-level otherwise. */
export type PostTarget = { channel: string; threadTs?: string };

export type UploadedFile = {
  id: string;
  title: string;
  size: number;
  localPath: string;
};

export type PostResult = {
  channel: string;
  /** Absent when Slack did not report the message an upload landed on. */
  ts?: string;
  permalink?: string;
  files: UploadedFile[];
};

export type ThreadMessage = {
  ts: string;
  /** ISO 8601, for a ticket's date line. */
  date: string;
  author: string;
  authorId?: string;
  text: string;
  files: SlackFile[];
};

export type SlackClientOptions = { token: string };

export function isNativeDoc(file: SlackFile): boolean {
  return (
    (file.mimetype ?? "").startsWith("application/vnd.slack") ||
    NATIVE_FILE_MODES.has(file.mode ?? "")
  );
}

/** `filename.replace` matches the Jira client, so evidence names line up on both sides. */
export function safeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_");
}

export function createSlackClient(options: SlackClientOptions) {
  const headers = { Authorization: `Bearer ${options.token}` };
  const userCache = new Map<string, string>();

  /**
   * Slack answers 200 for almost everything: `{ ok: false, error }` for API
   * problems, and an HTML login page when auth fails outright. Both become
   * thrown Errors here — for every verb, which is why `build` is a thunk rather
   * than a URL: a 429 retry needs a fresh request with the body intact.
   */
  async function send<T>(
    method: string,
    schema: z.ZodType<T>,
    build: () => Request,
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(build());

      if (res.status === 429) {
        const wait = Number(res.headers.get("retry-after") ?? 1);
        await Bun.sleep(wait * 1000);
        continue;
      }

      if (!res.headers.get("content-type")?.includes("application/json")) {
        throw new Error(
          `Slack ${method} returned ${res.status} ${
            res.headers.get("content-type") ?? "(no content-type)"
          } instead of JSON — usually an invalid or revoked token`,
        );
      }

      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        needed?: string;
      };
      if (!body.ok) {
        const needed = body.needed ? ` (needs scope: ${body.needed})` : "";
        throw new Error(
          `Slack ${method}: ${body.error ?? "unknown error"}${needed}`,
        );
      }

      return schema.parse(body);
    }

    throw new Error(`Slack ${method}: rate limited, gave up after one retry`);
  }

  /** Read methods: params ride the query string. */
  async function call<T>(
    method: string,
    schema: z.ZodType<T>,
    params: Record<string, string | number | boolean> = {},
  ): Promise<T> {
    return send(method, schema, () => {
      const url = new URL(`${API_BASE}/${method}`);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
      }
      return new Request(url.href, { headers });
    });
  }

  /**
   * Write methods: a JSON body, which is the only way to send the nested `files`
   * array `files.completeUploadExternal` wants, and it keeps message text with
   * newlines and markup out of the query string.
   */
  async function callPost<T>(
    method: string,
    schema: z.ZodType<T>,
    body: Record<string, unknown>,
  ): Promise<T> {
    return send(
      method,
      schema,
      () =>
        new Request(`${API_BASE}/${method}`, {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify(body),
        }),
    );
  }

  /** Workspace + bot identity. Also the cheapest way to validate a token. */
  async function authTest(): Promise<AuthTest> {
    return call("auth.test", authTestSchema);
  }

  async function getChannel(channel: string) {
    const { channel: info } = await call("conversations.info", channelSchema, {
      channel,
    });
    return info;
  }

  async function resolveUser(id: string): Promise<string> {
    const cached = userCache.get(id);
    if (cached) return cached;

    const { user } = await call("users.info", userSchema, { user: id });
    const name = user.profile?.real_name || user.real_name || user.name;
    userCache.set(id, name);
    return name;
  }

  /**
   * Every message of a thread, oldest first, with author display names resolved.
   * Falls back to `conversations.history` when `ts` is a standalone message,
   * which `conversations.replies` returns empty for.
   */
  async function getThread(
    channel: string,
    ts: string,
  ): Promise<ThreadMessage[]> {
    const collected: SlackMessage[] = [];
    let cursor: string | undefined;

    do {
      const page = await call("conversations.replies", repliesSchema, {
        channel,
        ts,
        inclusive: true,
        limit: 200,
        ...(cursor ? { cursor } : {}),
      });
      collected.push(...page.messages);
      cursor = page.response_metadata?.next_cursor || undefined;
    } while (cursor);

    if (collected.length === 0) {
      const single = await call("conversations.history", historySchema, {
        channel,
        latest: ts,
        oldest: ts,
        inclusive: true,
        limit: 1,
      });
      collected.push(...single.messages);
    }

    if (collected.length === 0) {
      throw new Error(
        `No message at ${ts} in ${channel}. The bot may not be in that channel — /invite it.`,
      );
    }

    return Promise.all(
      collected
        .sort((a, b) => Number(a.ts) - Number(b.ts))
        .map(async (message) => ({
          ts: message.ts,
          date: new Date(Number(message.ts.split(".")[0]) * 1000).toISOString(),
          author: message.user
            ? await resolveUser(message.user)
            : (message.username ?? message.bot_id ?? "(unknown)"),
          authorId: message.user,
          text: message.text ?? "",
          files: message.files ?? [],
        })),
    );
  }

  async function getPermalink(channel: string, ts: string): Promise<string> {
    const { permalink } = await call("chat.getPermalink", permalinkSchema, {
      channel,
      message_ts: ts,
    });
    return permalink;
  }

  /**
   * Fetch a file's bytes. Slack serves an HTML login page with a 200 status when
   * the token cannot reach the file, so the response is sniffed rather than
   * trusted — writing that page to disk as "evidence" is the failure this guards.
   */
  async function downloadFile(
    file: SlackFile,
    destPath: string,
  ): Promise<void> {
    if (isNativeDoc(file)) {
      throw new Error(
        `${file.name ?? file.id} is a Slack-native doc (${file.mimetype ?? file.mode}), not an uploaded file — it has no bytes to download`,
      );
    }
    if (!file.url_private_download) {
      throw new Error(`${file.name ?? file.id} has no url_private_download`);
    }

    const res = await fetch(file.url_private_download, {
      headers,
      redirect: "follow",
    });
    const bytes = new Uint8Array(await res.arrayBuffer());
    const head = new TextDecoder().decode(bytes.slice(0, 64)).toLowerCase();
    const isHtml =
      res.headers.get("content-type")?.includes("text/html") ||
      head.includes("<!doctype") ||
      head.includes("<html");

    if (isHtml) {
      throw new Error(
        `Slack returned an HTML page instead of ${file.name ?? file.id} — the bot is probably not in that channel, or files:read was not granted`,
      );
    }

    await Bun.write(destPath, bytes);
  }

  /**
   * Download every downloadable file in a thread into `outDir` (a fresh temp dir
   * when omitted). Names are `<n>-<author>-<file>` so the files stay
   * self-describing once they are attached to a ticket.
   */
  async function downloadThreadFiles(
    messages: ThreadMessage[],
    outDir?: string,
  ): Promise<{
    dir: string;
    downloaded: Array<SlackFile & { localPath: string; author: string }>;
    skipped: Array<SlackFile & { reason: string }>;
  }> {
    const dir = outDir ?? (await mkdtemp(path.join(tmpdir(), "slack-thread-")));
    const downloaded: Array<SlackFile & { localPath: string; author: string }> =
      [];
    const skipped: Array<SlackFile & { reason: string }> = [];

    let index = 0;
    for (const message of messages) {
      for (const file of message.files) {
        if (isNativeDoc(file)) {
          skipped.push({
            ...file,
            reason: `Slack-native ${file.mode ?? "doc"} — no bytes to download`,
          });
          continue;
        }

        index += 1;
        const author = safeFileName(message.author);
        const name = safeFileName(file.name ?? file.title ?? file.id);
        const localPath = path.join(dir, `${index}-${author}-${name}`);
        await downloadFile(file, localPath);
        downloaded.push({ ...file, localPath, author: message.author });
      }
    }

    return { dir, downloaded, skipped };
  }

  /**
   * Reserve a URL, then push the bytes to it. The file exists in Slack after
   * this but is attached to nothing — only `files.completeUploadExternal` shares
   * it into a channel.
   */
  async function uploadBytes(filePath: string): Promise<UploadedFile> {
    const file = Bun.file(filePath);
    if (!(await file.exists())) throw new Error(`No such file: ${filePath}`);

    const size = file.size;
    if (size === 0)
      throw new Error(
        `${filePath} is empty — Slack rejects a zero-byte upload`,
      );

    const title = path.basename(filePath);
    const { upload_url, file_id } = await call(
      "files.getUploadURLExternal",
      uploadUrlSchema,
      {
        filename: title,
        length: size,
      },
    );

    // Pre-signed storage, not the Web API: it takes the raw bytes and answers
    // with a bare status, so there is no `ok` envelope for `send` to unwrap.
    const res = await fetch(upload_url, {
      method: "POST",
      body: await file.arrayBuffer(),
    });
    if (!res.ok) {
      throw new Error(
        `Uploading ${title} failed: ${res.status} ${res.statusText}`,
      );
    }

    return { id: file_id, title, size, localPath: filePath };
  }

  /**
   * The message a completed upload landed on, read back off the file's share
   * record because `files.completeUploadExternal` does not report it. Slack
   * fills that record in asynchronously — it is reliably empty on the first
   * read, and a video takes several seconds longer than an image — so this
   * polls, backing off to roughly eight seconds before giving up. An image
   * resolves on the second attempt, so the long tail is only paid when it is
   * actually needed.
   *
   * Best effort by design: the post has already succeeded by the time this
   * runs, so giving up costs a permalink, not the message.
   */
  async function shareTs(
    fileId: string | undefined,
    channel: string,
  ): Promise<string | undefined> {
    if (!fileId) return undefined;

    for (let attempt = 0; attempt < 7; attempt++) {
      if (attempt > 0) await Bun.sleep(400 * attempt);

      const { data } = await tryCatch(
        call("files.info", fileInfoSchema, { file: fileId }),
      );
      for (const byChannel of Object.values(data?.file.shares ?? {})) {
        for (const [id, entries] of Object.entries(byChannel)) {
          if (id.toUpperCase() !== channel.toUpperCase()) continue;
          const ts = entries.find((entry) => entry.ts)?.ts;
          if (ts) return ts;
        }
      }
    }
    return undefined;
  }

  async function permalinkOrNothing(
    channel: string,
    ts?: string,
  ): Promise<string | undefined> {
    if (!ts) return undefined;
    const { data } = await tryCatch(getPermalink(channel, ts));
    return data ?? undefined;
  }

  /**
   * One message of a thread by its own `ts` — what a delete needs before it can
   * show the operator what is about to go, and which files went with it.
   *
   * `parentTs` is the thread the message lives in (its own ts when it is not a
   * reply), because a reply is only reachable through `conversations.replies` on
   * its parent.
   */
  async function getMessage(
    channel: string,
    parentTs: string,
    ts: string,
  ): Promise<ThreadMessage> {
    const messages = await getThread(channel, parentTs);
    const found = messages.find((message) => message.ts === ts);
    if (!found) {
      throw new Error(
        `No message at ${ts} in ${channel} — it may already be deleted`,
      );
    }
    return found;
  }

  /**
   * Take a message back off the channel.
   *
   * Scoped to the bot's **own** messages: `chat.delete` with a bot token answers
   * `cant_delete_message` for anything a human posted, which is the guard rail
   * rather than a bug to work around.
   *
   * The files a message carried are **not** removed with it — they leave the
   * channel but stay in the workspace's file list, so a caller draining a
   * rehearsal deletes them too (see {@link deleteFile}).
   */
  async function deleteMessage(channel: string, ts: string): Promise<void> {
    await callPost("chat.delete", deleteMessageSchema, { channel, ts });
  }

  /** Delete an uploaded file outright — the bot's own uploads only. */
  async function deleteFile(fileId: string): Promise<void> {
    await callPost("files.delete", okSchema, { file: fileId });
  }

  /**
   * Post `text`, with `paths` attached to that same message.
   *
   * Slack's upload flow is per-file, but only the completing call shares into a
   * channel — so completing every file in one call is what puts them on a single
   * message with the text, instead of one message per file. `text` becomes that
   * message's body, and Slack renders it as mrkdwn (`*bold*`, `_italic_`), not
   * as the markdown superset.
   *
   * `onProgress` reports the step, since a large video makes this slow.
   */
  async function post(
    target: PostTarget,
    input: { text?: string; paths?: string[] },
    onProgress?: (message: string) => void,
  ): Promise<PostResult> {
    const paths = input.paths ?? [];
    const text = input.text?.trim() ? input.text : undefined;
    const thread = target.threadTs ? { thread_ts: target.threadTs } : {};

    if (!text && paths.length === 0) {
      throw new Error(
        "Nothing to post — pass a message, one or more files, or both",
      );
    }

    if (paths.length === 0) {
      const sent = await callPost("chat.postMessage", postMessageSchema, {
        channel: target.channel,
        text,
        ...thread,
      });
      return {
        channel: sent.channel,
        ts: sent.ts,
        permalink: await permalinkOrNothing(sent.channel, sent.ts),
        files: [],
      };
    }

    const uploaded: UploadedFile[] = [];
    for (const [index, filePath] of paths.entries()) {
      onProgress?.(
        `Uploading ${index + 1}/${paths.length}: ${path.basename(filePath)}`,
      );
      uploaded.push(await uploadBytes(filePath));
    }

    onProgress?.(`Posting to ${target.channel}`);
    const completed = await callPost(
      "files.completeUploadExternal",
      completeUploadSchema,
      {
        files: uploaded.map(({ id, title }) => ({ id, title })),
        channel_id: target.channel,
        ...(text ? { initial_comment: text } : {}),
        ...thread,
      },
    );

    const ts = await shareTs(completed.files[0]?.id, target.channel);
    return {
      channel: target.channel,
      ts,
      permalink: await permalinkOrNothing(target.channel, ts),
      files: uploaded,
    };
  }

  return {
    authTest,
    getChannel,
    getThread,
    getPermalink,
    downloadFile,
    downloadThreadFiles,
    resolveUser,
    post,
    getMessage,
    deleteMessage,
    deleteFile,
  };
}

export type SlackClient = ReturnType<typeof createSlackClient>;
