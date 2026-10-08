import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  DATE_KEY_REGEX,
  driveFromToken,
  getOrCreateDateFolder,
  uploadFile,
} from "@/lib/drive";
import type { DiaryEntry } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_TRANSCRIPTION_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";
const WHISPER_MODEL = "whisper-large-v3";

/**
 * Transcribe an audio buffer with Groq's Whisper endpoint.
 * Uses the REST API directly (native fetch/FormData/Blob) so no extra SDK is needed.
 */
async function transcribeWithGroq(
  apiKey: string,
  data: ArrayBuffer,
  fileName: string,
  mimeType: string,
): Promise<string> {
  const body = new FormData();
  body.append("file", new Blob([data], { type: mimeType }), fileName);
  body.append("model", WHISPER_MODEL);
  body.append("response_format", "json");

  const res = await fetch(GROQ_TRANSCRIPTION_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq transcription failed (${res.status}): ${detail}`);
  }

  const payload = (await res.json()) as { text?: string };
  return payload.text ?? "";
}

const EXT_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/**
 * POST /api/diary/record
 * Receives an audio blob (multipart/form-data), transcribes it with Groq
 * Whisper, then stores the audio + entry.json in the user's Google Drive.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured" },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const audio = form.get("audio");
  const dateKey = String(form.get("date") ?? "");

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }
  if (!DATE_KEY_REGEX.test(dateKey)) {
    return NextResponse.json(
      { error: "Invalid date (expected DD-MM-YYYY)" },
      { status: 400 },
    );
  }

  const arrayBuffer = await audio.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = audio.type || "audio/webm";
  const timestamp = Date.now();
  const ext = EXT_BY_MIME[mimeType] ?? "webm";
  const audioFileName = `recording_${timestamp}.${ext}`;

  try {
    // 1. Transcribe with Groq Whisper.
    const transcript = await transcribeWithGroq(
      apiKey,
      arrayBuffer,
      audioFileName,
      mimeType,
    );

    // 2. Upload audio + companion JSON to Google Drive.
    const drive = driveFromToken(session.accessToken);
    const folder = await getOrCreateDateFolder(drive, dateKey);
    if (!folder.id) throw new Error("Could not create Drive folder");

    const uploaded = await uploadFile(drive, {
      name: audioFileName,
      mimeType,
      body: buffer,
      parentId: folder.id,
    });

    const entry: DiaryEntry = {
      date: dateKey,
      timestamp,
      transcript,
      audioFileId: uploaded.id ?? "",
      audioFileName,
      audioLink: uploaded.webViewLink ?? "",
    };

    await uploadFile(drive, {
      name: "entry.json",
      mimeType: "application/json",
      body: JSON.stringify(entry, null, 2),
      parentId: folder.id,
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Failed to process recording", error);
    const message =
      error instanceof Error ? error.message : "Failed to process recording";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
