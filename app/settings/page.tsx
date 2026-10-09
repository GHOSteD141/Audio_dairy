"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Save,
  Trash2,
} from "lucide-react";

type Source = "settings" | "env" | "default" | "none";

interface SettingsResponse {
  groqApiKey: { set: boolean; preview: string; source: Exclude<Source, "default"> };
  whisperModel: { value: string; source: Source; default: string };
  environment: {
    googleOAuthConfigured: boolean;
    nextAuthSecretConfigured: boolean;
  };
}

const sourceLabel: Record<Source, string> = {
  settings: "Saved in your Google Drive",
  env: "From environment variables",
  default: "Built-in default",
  none: "Not configured",
};

/** Fetch the (masked) settings from the server. Returns null when unauthenticated. */
async function fetchSettings(): Promise<SettingsResponse | null> {
  const res = await fetch("/api/settings");
  if (res.status === 401) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to load settings");
  return data as SettingsResponse;
}

export default function SettingsPage() {
  const { status } = useSession();

  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const data = await fetchSettings();
    if (data) {
      setSettings(data);
      setModel(data.whisperModel.value);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    void (async () => {
      try {
        const data = await fetchSettings();
        if (cancelled || !data) return;
        setSettings(data);
        setModel(data.whisperModel.value);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load settings");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  const save = async (payload: Record<string, string>) => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      setApiKey("");
      setMessage("Settings saved to your Google Drive.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    const payload: Record<string, string> = { whisperModel: model };
    if (apiKey.trim()) payload.groqApiKey = apiKey.trim();
    void save(payload);
  };

  const handleRemoveKey = async () => {
    setRemoving(true);
    try {
      await save({ groqApiKey: "" });
    } finally {
      setRemoving(false);
    }
  };

  const card = "rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4";
  const label = "block text-xs font-semibold uppercase tracking-wide text-slate-400";
  const input =
    "w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none";

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto p-6 space-y-6">
      <header className="flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="text-xl font-bold text-white">Settings</h1>
      </header>

      {status === "loading" || (status === "authenticated" && !settings && !error) ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : status !== "authenticated" ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center space-y-4">
          <Lock className="w-8 h-8 text-sky-400 mx-auto" />
          <h2 className="text-lg font-semibold text-white">Sign in to manage settings</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Settings are stored privately in your own Google Drive, so you need to be
            signed in to view or change them.
          </p>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => signIn("google")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition"
            >
              <LogIn className="w-4 h-4" /> Sign in with Google
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className={card}>
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-sky-400" />
              <h2 className="text-lg font-semibold text-white">Groq API key</h2>
            </div>
            <p className="text-xs text-slate-400">
              Used to transcribe recordings with Whisper. Stored in{" "}
              <span className="text-sky-400">Audio Diary/config.json</span> in your own
              Drive — never sent anywhere except Groq.
            </p>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs space-y-1">
              <p className="text-slate-300">
                Status:{" "}
                {settings?.groqApiKey.set ? (
                  <span className="text-emerald-400">
                    configured ({settings.groqApiKey.preview})
                  </span>
                ) : (
                  <span className="text-amber-400">not configured</span>
                )}
              </p>
              <p className="text-slate-500">
                Source: {sourceLabel[settings?.groqApiKey.source ?? "none"]}
              </p>
            </div>

            <div>
              <label className={label} htmlFor="groq-key">
                Replace key
              </label>
              <input
                id="groq-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={settings?.groqApiKey.set ? "Enter a new key to replace" : "gsk_…"}
                className={input}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Get a key from{" "}
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:underline"
                >
                  console.groq.com/keys
                </a>
                . Leave blank to keep the current one.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-sm font-semibold transition"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save settings
              </button>
              {settings?.groqApiKey.source === "settings" && (
                <button
                  type="button"
                  onClick={handleRemoveKey}
                  disabled={removing || saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-60 text-sm font-medium transition"
                >
                  {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Remove stored key
                </button>
              )}
            </div>
          </section>
          <section className={card}>
            <h2 className="text-lg font-semibold text-white">Transcription model</h2>
            <div>
              <label className={label} htmlFor="whisper-model">
                Whisper model
              </label>
              <input
                id="whisper-model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={settings?.whisperModel.default ?? "whisper-large-v3"}
                className={input}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Source: {sourceLabel[settings?.whisperModel.source ?? "default"]}. Leave blank
                to use the default ({settings?.whisperModel.default ?? "whisper-large-v3"}).
              </p>
            </div>
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold text-white">Environment</h2>
            <p className="text-xs text-slate-400">
              These values are required before the server starts and are configured as
              environment variables (e.g. in the Vercel dashboard). They cannot be changed
              from the app.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-slate-300">
                {settings?.environment.googleOAuthConfigured ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Lock className="w-4 h-4 text-amber-400" />
                )}
                Google OAuth client (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)
              </li>
              <li className="flex items-center gap-2 text-slate-300">
                {settings?.environment.nextAuthSecretConfigured ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Lock className="w-4 h-4 text-amber-400" />
                )}
                NextAuth secret (NEXTAUTH_SECRET)
              </li>
            </ul>
          </section>

          {message && (
            <p className="flex items-center gap-2 text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4" /> {message}
            </p>
          )}
          {error && <p className="text-rose-400 text-xs">{error}</p>}
        </>
      )}
    </main>
  );
}
