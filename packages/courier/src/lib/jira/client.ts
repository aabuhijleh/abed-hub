import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { adfToText } from "./adf";

const LINK_FIELD_NAME = "Link";

const userSchema = z
  .object({
    displayName: z.string(),
    emailAddress: z.string().optional(),
    accountId: z.string().optional(),
  })
  .nullable();

const attachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string().optional(),
  size: z.number().optional(),
  content: z.string().optional(),
  created: z.string().optional(),
  author: userSchema.optional(),
});

const issueResponseSchema = z.object({
  key: z.string(),
  fields: z
    .object({
      summary: z.string().nullable().optional(),
      description: z.unknown().nullable().optional(),
      reporter: userSchema.optional(),
      attachment: z.array(attachmentSchema).optional(),
    })
    .passthrough(),
});

export type IssueData = {
  key: string;
  title: string;
  description: string;
  link: string | null;
  reporter: {
    displayName: string;
    emailAddress?: string;
  } | null;
  attachments: Array<{
    id: string;
    filename: string;
    mimeType?: string;
    size?: number;
    content?: string;
    localPath?: string;
  }>;
  attachmentsDir?: string;
};

export type UploadedAttachment = {
  id: string;
  filename: string;
  mimeType?: string;
  size?: number;
};

export type JiraClientOptions = {
  baseUrl: string;
  email: string;
  apiToken: string;
};

function authHeader(email: string, apiToken: string): string {
  return `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
}

export function createJiraClient(options: JiraClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const headers = {
    Authorization: authHeader(options.email, options.apiToken),
    Accept: "application/json",
  };

  async function getJson<T>(pathName: string): Promise<T> {
    const res = await fetch(`${baseUrl}${pathName}`, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Jira API ${res.status}: ${body || res.statusText}`);
    }
    return (await res.json()) as T;
  }

  async function downloadAttachment(
    contentUrl: string,
    destPath: string,
  ): Promise<void> {
    const res = await fetch(contentUrl, {
      headers: { Authorization: headers.Authorization },
    });
    if (!res.ok) {
      throw new Error(
        `Failed to download attachment (${res.status}): ${contentUrl}`,
      );
    }
    await Bun.write(destPath, res);
  }

  async function resolveLinkFieldId(): Promise<string | null> {
    const fields =
      await getJson<Array<{ id: string; name: string }>>("/rest/api/3/field");
    return fields.find((f) => f.name === LINK_FIELD_NAME)?.id ?? null;
  }

  async function getIssue(issueKey: string): Promise<IssueData> {
    const linkFieldId = await resolveLinkFieldId();
    const fieldList = ["summary", "description", "reporter", "attachment"];
    if (linkFieldId) fieldList.push(linkFieldId);

    const issueRaw = await getJson<unknown>(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=${fieldList.join(",")}`,
    );
    const issue = issueResponseSchema.parse(issueRaw);

    const linkValue = linkFieldId ? issue.fields[linkFieldId] : null;
    const link = adfToText(linkValue).trim() || null;

    const rawAttachments = issue.fields.attachment ?? [];

    let attachmentsDir: string | undefined;
    const downloaded = new Map<string, string>();

    if (rawAttachments.length > 0) {
      const dir = await mkdtemp(path.join(tmpdir(), `jira-${issue.key}-`));
      attachmentsDir = dir;
      await Promise.all(
        rawAttachments.map(async (a, index) => {
          if (!a.content) return;
          const safeName = a.filename.replace(/[^\w.-]+/g, "_");
          const destPath = path.join(dir, `${index + 1}-${safeName}`);
          await downloadAttachment(a.content, destPath);
          downloaded.set(a.id, destPath);
        }),
      );
    }

    return {
      key: issue.key,
      title: issue.fields.summary ?? "(no title)",
      description: adfToText(issue.fields.description).trim(),
      link,
      reporter: issue.fields.reporter
        ? {
            displayName: issue.fields.reporter.displayName,
            emailAddress: issue.fields.reporter.emailAddress,
          }
        : null,
      attachments: rawAttachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        content: a.content,
        localPath: downloaded.get(a.id),
      })),
      attachmentsDir,
    };
  }

  /** Upload files to an issue (Jira accepts several `file` parts per request). */
  async function addAttachments(
    issueKey: string,
    filePaths: string[],
  ): Promise<UploadedAttachment[]> {
    if (filePaths.length === 0) return [];

    const form = new FormData();
    for (const filePath of filePaths) {
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        throw new Error(`File not found: ${filePath}`);
      }
      form.append("file", file, path.basename(filePath));
    }

    const res = await fetch(
      `${baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/attachments`,
      {
        method: "POST",
        headers: { ...headers, "X-Atlassian-Token": "no-check" },
        body: form,
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Jira API ${res.status}: ${body || res.statusText}`);
    }

    const uploaded = z.array(attachmentSchema).parse(await res.json());
    return uploaded.map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
    }));
  }

  return { getIssue, addAttachments };
}

export type JiraClient = ReturnType<typeof createJiraClient>;
