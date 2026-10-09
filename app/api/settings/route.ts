import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { driveFromToken } from "@/lib/drive";
import { DEFAULT_WHISPER_MODEL, readSettings, writeSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Show only the first/last few characters of a secret. */
function mask(value: string): string {
  if (value.length <= 8) return "••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

const asTrimmed = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * GET /api/settings
 * Returns the effective configuration WITHOUT ever exposing full secrets.
 * `config.json` lives in the user's own Drive, so this needs an authenticated session.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const drive = driveFromToken(session.accessToken);
    const settings = await readSettings(drive);

    const storedKey = asTrimmed(settings.groqApiKey);
    const envKey = asTrimmed(process.env.GROQ_API_KEY);
    const storedModel = asTrimmed(settings.whisperModel);
    const envModel = asTrimmed(process.env.WHISPER_MODEL);

    const effectiveKey = storedKey || envKey;
    const effectiveModel = storedModel || envModel || DEFAULT_WHISPER_MODEL;

    return NextResponse.json({
      groqApiKey: {
        set: Boolean(effectiveKey),
        preview: effectiveKey ? mask(effectiveKey) : "",
        source: storedKey ? "settings" : envKey ? "env" : "none",
      },
      whisperModel: {
        value: effectiveModel,
        source: storedModel ? "settings" : envModel ? "env" : "default",
        default: DEFAULT_WHISPER_MODEL,
      },
      // Read-only status for values that MUST remain environment variables.
      environment: {
        googleOAuthConfigured: Boolean(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
        ),
        nextAuthSecretConfigured: Boolean(process.env.NEXTAUTH_SECRET),
      },
    });
  } catch (error) {
    console.error("Failed to read settings", error);
    const message = error instanceof Error ? error.message : "Failed to read settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/settings
 * Body: { groqApiKey?: string | null, whisperModel?: string }
 *   - a non-empty `groqApiKey`/`whisperModel` is stored;
 *   - an empty string clears it (falling back to env / default);
 *   - omitting a field leaves it unchanged.
 */
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  try {
    const drive = driveFromToken(session.accessToken);
    const next = { ...(await readSettings(drive)) };
    const payload = body as Record<string, unknown>;

    if ("groqApiKey" in payload) {
      const value = asTrimmed(payload.groqApiKey);
      if (value) next.groqApiKey = value;
      else delete next.groqApiKey;
    }

    if ("whisperModel" in payload) {
      const value = asTrimmed(payload.whisperModel);
      if (value) next.whisperModel = value;
      else delete next.whisperModel;
    }

    await writeSettings(drive, next);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to save settings", error);
    const message = error instanceof Error ? error.message : "Failed to save settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
