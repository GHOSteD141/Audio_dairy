import { google, type drive_v3 } from "googleapis";
import { Readable } from "stream";
import type { DiaryEntry } from "./types";

export type DriveClient = drive_v3.Drive;

export const ROOT_FOLDER_NAME = "Audio Diary";
export const DATE_KEY_REGEX = /^\d{2}-\d{2}-\d{4}$/;
const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Build an authenticated Drive client from a user's OAuth access token. */
export function driveFromToken(accessToken: string): DriveClient {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth: oauth2Client });
}

/** Escape single quotes / backslashes so names are safe inside a Drive `q` query. */
function escapeQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findFolder(
  drive: DriveClient,
  name: string,
  parentId?: string,
): Promise<drive_v3.Schema$File | null> {
  const clauses = [`mimeType = '${FOLDER_MIME}'`, `name = '${escapeQuery(name)}'`, "trashed = false"];
  if (parentId) clauses.push(`'${parentId}' in parents`);

  const { data } = await drive.files.list({
    q: clauses.join(" and "),
    fields: "files(id, name)",
    spaces: "drive",
    pageSize: 1,
  });
  return data.files?.[0] ?? null;
}

async function findFile(
  drive: DriveClient,
  name: string,
  parentId: string,
): Promise<drive_v3.Schema$File | null> {
  const { data } = await drive.files.list({
    q: `name = '${escapeQuery(name)}' and '${parentId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType)",
    spaces: "drive",
    pageSize: 1,
  });
  return data.files?.[0] ?? null;
}

/** Find (or create) the top-level "Audio Diary" folder. */
export async function getOrCreateRootFolder(drive: DriveClient) {
  const existing = await findFolder(drive, ROOT_FOLDER_NAME);
  if (existing?.id) return existing;

  const { data } = await drive.files.create({
    requestBody: { name: ROOT_FOLDER_NAME, mimeType: FOLDER_MIME },
    fields: "id, name",
  });
  return data;
}

/** Find (or create) the "Audio Diary / DD-MM-YYYY" folder. */
export async function getOrCreateDateFolder(drive: DriveClient, dateKey: string) {
  const root = await getOrCreateRootFolder(drive);
  const existing = await findFolder(drive, dateKey, root.id ?? undefined);
  if (existing?.id) return existing;

  const { data } = await drive.files.create({
    requestBody: {
      name: dateKey,
      mimeType: FOLDER_MIME,
      parents: root.id ? [root.id] : undefined,
    },
    fields: "id, name",
  });
  return data;
}

interface UploadOptions {
  name: string;
  mimeType: string;
  body: Buffer | string;
  parentId: string;
}

/** Upload a file (audio blob or JSON string) into a Drive folder. */
export async function uploadFile(drive: DriveClient, opts: UploadOptions) {
  const { data } = await drive.files.create({
    requestBody: { name: opts.name, parents: [opts.parentId] },
    media: {
      mimeType: opts.mimeType,
      body: typeof opts.body === "string" ? opts.body : Readable.from(opts.body),
    },
    fields: "id, name, webViewLink, webContentLink",
  });
  return data;
}

/** Return every recorded date key (DD-MM-YYYY) for the calendar. */
export async function listDateKeys(drive: DriveClient): Promise<string[]> {
  const root = await findFolder(drive, ROOT_FOLDER_NAME);
  if (!root?.id) return [];

  const { data } = await drive.files.list({
    q: `'${root.id}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
    pageSize: 1000,
  });

  return (data.files ?? [])
    .map((file) => file.name ?? "")
    .filter((name) => DATE_KEY_REGEX.test(name))
    .sort();
}

/** Find the Drive folder for a specific date, or null if it does not exist. */
export async function getDateFolder(drive: DriveClient, dateKey: string) {
  const root = await findFolder(drive, ROOT_FOLDER_NAME);
  if (!root?.id) return null;
  return findFolder(drive, dateKey, root.id);
}

/** Read and parse the `entry.json` for a date. */
export async function readEntry(drive: DriveClient, dateKey: string): Promise<DiaryEntry | null> {
  const folder = await getDateFolder(drive, dateKey);
  if (!folder?.id) return null;

  const json = await findFile(drive, "entry.json", folder.id);
  if (!json?.id) return null;

  const { data } = await drive.files.get(
    { fileId: json.id, alt: "media" },
    { responseType: "arraybuffer" },
  );
  return JSON.parse(Buffer.from(data as ArrayBuffer).toString("utf-8")) as DiaryEntry;
}

/** Download any Drive file as a buffer plus its mime type. */
export async function downloadFile(drive: DriveClient, fileId: string) {
  const meta = await drive.files.get({ fileId, fields: "id, name, mimeType" });
  const { data } = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" },
  );
  return {
    buffer: Buffer.from(data as ArrayBuffer),
    mimeType: meta.data.mimeType ?? "application/octet-stream",
  };
}
