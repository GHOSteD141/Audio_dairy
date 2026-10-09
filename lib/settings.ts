import type { DriveClient } from "./drive";
import { findFile, findRootFolder, getOrCreateRootFolder, uploadFile } from "./drive";

/**
 * User-editable settings, stored in the user's own Google Drive at
 * `Audio Diary / config.json`. Keeping them here preserves the app's zero-DB
 * design, keeps them private, and lets them sync across devices.
 *
 * Secrets that NextAuth needs at startup (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 * / NEXTAUTH_SECRET) intentionally live only in environment variables.
 */
export interface AppSettings {
  /** Groq API key used for Whisper transcription. Empty -> fall back to env. */
  groqApiKey?: string;
  /** Whisper model id. Empty -> fall back to env or the built-in default. */
  whisperModel?: string;
}

export const SETTINGS_FILE_NAME = "config.json";
export const DEFAULT_WHISPER_MODEL = "whisper-large-v3";

export type SettingSource = "settings" | "env" | "default" | "none";

/** Read `config.json` from the Drive root. Returns `{}` when absent/unreadable. */
export async function readSettings(drive: DriveClient): Promise<AppSettings> {
  const root = await findRootFolder(drive);
  if (!root?.id) return {};

  const file = await findFile(drive, SETTINGS_FILE_NAME, root.id);
  if (!file?.id) return {};

  const { data } = await drive.files.get(
    { fileId: file.id, alt: "media" },
    { responseType: "arraybuffer" },
  );

  try {
    return JSON.parse(Buffer.from(data as ArrayBuffer).toString("utf-8")) as AppSettings;
  } catch {
    return {};
  }
}

/** Create or overwrite `config.json` in the Drive root. */
export async function writeSettings(drive: DriveClient, settings: AppSettings) {
  const root = await getOrCreateRootFolder(drive);
  if (!root.id) throw new Error("Could not create Drive folder");

  const body = JSON.stringify(settings, null, 2);
  const existing = await findFile(drive, SETTINGS_FILE_NAME, root.id);

  if (existing?.id) {
    const { data } = await drive.files.update({
      fileId: existing.id,
      media: { mimeType: "application/json", body },
      fields: "id, name, modifiedTime",
    });
    return data;
  }

  return uploadFile(drive, {
    name: SETTINGS_FILE_NAME,
    mimeType: "application/json",
    body,
    parentId: root.id,
  });
}

export interface ResolvedGroqConfig {
  apiKey: string;
  model: string;
  /** Where the key came from, for surfacing in the settings UI. */
  keySource: Extract<SettingSource, "settings" | "env" | "none">;
  /** Where the model came from. */
  modelSource: Extract<SettingSource, "settings" | "env" | "default">;
}

/**
 * Resolve the effective Groq credentials.
 * Precedence: Drive settings -> environment variables -> built-in default.
 */
export async function resolveGroqConfig(drive: DriveClient): Promise<ResolvedGroqConfig> {
  const settings = await readSettings(drive);
  const storedKey = settings.groqApiKey?.trim();
  const envKey = process.env.GROQ_API_KEY?.trim();
  const storedModel = settings.whisperModel?.trim();
  const envModel = process.env.WHISPER_MODEL?.trim();

  return {
    apiKey: storedKey || envKey || "",
    model: storedModel || envModel || DEFAULT_WHISPER_MODEL,
    keySource: storedKey ? "settings" : envKey ? "env" : "none",
    modelSource: storedModel ? "settings" : envModel ? "env" : "default",
  };
}
