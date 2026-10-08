import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DATE_KEY_REGEX, downloadFile, driveFromToken, readEntry } from "@/lib/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/diary/entries/[date]
 *   - default: JSON `{ entry }` (transcript, timestamp, audio link).
 *   - `?audio=true`: streams the raw audio file for in-app playback.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { date } = await params;
  if (!DATE_KEY_REGEX.test(date)) {
    return NextResponse.json(
      { error: "Invalid date (expected DD-MM-YYYY)" },
      { status: 400 },
    );
  }

  try {
    const drive = driveFromToken(session.accessToken);
    const entry = await readEntry(drive, date);
    if (!entry) {
      return NextResponse.json(
        { error: "No entry stored for this date" },
        { status: 404 },
      );
    }

    const wantsAudio = new URL(req.url).searchParams.get("audio") === "true";
    if (wantsAudio) {
      const { buffer, mimeType } = await downloadFile(drive, entry.audioFileId);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(buffer.byteLength),
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Failed to load diary entry", error);
    const message = error instanceof Error ? error.message : "Failed to load entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
