import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { driveFromToken, listDateKeys } from "@/lib/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/diary/entries
 * Returns the list of recorded date keys (DD-MM-YYYY) used to paint the calendar.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const drive = driveFromToken(session.accessToken);
    const dates = await listDateKeys(drive);
    return NextResponse.json({ dates });
  } catch (error) {
    console.error("Failed to list diary entries", error);
    const message = error instanceof Error ? error.message : "Failed to list entries";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
