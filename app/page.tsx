"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { format, parse } from "date-fns";
import { CalendarDays, FileAudio, Loader2, LogIn, LogOut } from "lucide-react";
import AudioRecorder from "@/components/AudioRecorder";
import CalendarView from "@/components/CalendarView";
import type { DiaryEntry } from "@/lib/types";

const dateKey = (date: Date) => format(date, "dd-MM-yyyy");

export default function HomePage() {
  const { data: session, status } = useSession();

  const [markedDates, setMarkedDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => dateKey(new Date()));
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthed = status === "authenticated";

  const loadDates = useCallback(async () => {
    try {
      const res = await fetch("/api/diary/entries");
      if (res.status === 401) {
        setMarkedDates([]);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load entries");
      setMarkedDates(data.dates ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entries");
    }
  }, []);

  const loadEntry = useCallback(async (key: string) => {
    setLoadingEntry(true);
    setEntry(null);
    try {
      const res = await fetch(`/api/diary/entries/${key}`);
      if (res.status === 404) return;
      if (!res.ok) throw new Error("Failed to load entry");
      const data = await res.json();
      setEntry(data.entry ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entry");
    } finally {
      setLoadingEntry(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthed) {
      void loadDates();
    } else if (status === "unauthenticated") {
      setMarkedDates([]);
      setEntry(null);
    }
  }, [isAuthed, status, loadDates]);

  useEffect(() => {
    if (!isAuthed) return;
    if (markedDates.includes(selectedDate)) void loadEntry(selectedDate);
    else setEntry(null);
  }, [isAuthed, selectedDate, markedDates, loadEntry]);

  const handleUploaded = useCallback(() => {
    void loadDates();
    void loadEntry(selectedDate);
  }, [loadDates, loadEntry, selectedDate]);

  const displayDate = format(
    parse(selectedDate, "dd-MM-yyyy", new Date()),
    "EEEE, d MMMM yyyy",
  );

  if (status === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
      </div>
    );
  }

  const signInButton = (
    <button
      type="button"
      onClick={() => signIn("google")}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition"
    >
      <LogIn className="w-4 h-4" /> Sign in with Google
    </button>
  );

  return (
    <main className="flex-1 w-full max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-7 h-7 text-sky-400" />
          <h1 className="text-xl font-bold text-white">Audio Diary</h1>
        </div>

        {isAuthed ? (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm text-white">{session?.user?.name ?? "You"}</p>
              <p className="text-xs text-slate-400">{session?.user?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 text-sm font-medium transition"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        ) : (
          signInButton
        )}
      </header>

      {!isAuthed ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center space-y-4">
          <h2 className="text-lg font-semibold text-white">
            Your voice diary, stored in your own Drive
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Sign in with Google to record daily voice memos. Audio and transcripts are saved
            privately to an <span className="text-sky-400">Audio Diary</span> folder in your
            Google Drive.
          </p>
          <div className="flex justify-center">{signInButton}</div>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
          <div className="space-y-6">
            <CalendarView
              markedDates={markedDates}
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
            />
            <AudioRecorder date={selectedDate} onUploaded={handleUploaded} />
          </div>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 min-h-[320px]">
            <div className="flex items-center gap-2">
              <FileAudio className="w-5 h-5 text-sky-400" />
              <h2 className="text-lg font-semibold text-white">{displayDate}</h2>
            </div>

            {loadingEntry ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : entry ? (
              <div className="space-y-4">
                <audio
                  controls
                  preload="none"
                  className="w-full"
                  src={`/api/diary/entries/${selectedDate}?audio=true`}
                />
                <p className="text-xs text-slate-500">
                  Recorded {new Date(entry.timestamp).toLocaleString()}
                </p>
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {entry.transcript || "(no speech detected)"}
                  </p>
                </div>
                {entry.audioLink && (
                  <a
                    href={entry.audioLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-sky-400 hover:underline"
                  >
                    Open audio in Google Drive
                  </a>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center gap-2 py-16 text-slate-500">
                <FileAudio className="w-8 h-8" />
                <p className="text-sm">No recording for this day yet.</p>
                <p className="text-xs">Use the recorder to add a memo for {displayDate}.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {error && <p className="text-rose-400 text-xs">{error}</p>}
    </main>
  );
}
