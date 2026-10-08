"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Mic, Square } from "lucide-react";

type Status = "idle" | "recording" | "uploading" | "done" | "error";

interface AudioRecorderProps {
  /** Date key (DD-MM-YYYY) the recording belongs to. */
  date: string;
  /** Called after a successful upload so the parent can refresh. */
  onUploaded?: () => void;
}

export default function AudioRecorder({ date, onUploaded }: AudioRecorderProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopTimer();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      releaseStream();
    };
  }, []);

  const handleUpload = async () => {
    const mimeType = recorderRef.current?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    releaseStream();

    if (blob.size === 0) {
      setError("Nothing was recorded.");
      setStatus("error");
      return;
    }

    try {
      const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "webm";
      const form = new FormData();
      form.append("audio", blob, `recording_${Date.now()}.${ext}`);
      form.append("date", date);

      const res = await fetch("/api/diary/record", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }

      setStatus("done");
      onUploaded?.();
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus("error");
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        void handleUpload();
      };

      recorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      console.error(err);
      setError("Microphone permission denied or unavailable.");
      setStatus("error");
    }
  };

  const stopRecording = () => {
    stopTimer();
    if (recorderRef.current?.state === "recording") {
      setStatus("uploading");
      recorderRef.current.stop();
    }
  };

  const formatTime = (total: number) =>
    `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

  const busy = status === "uploading";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col items-center gap-4">
      <h2 className="text-lg font-semibold text-white">Record a memo</h2>
      <p className="text-xs text-slate-400">
        {status === "recording"
          ? `Recording… ${formatTime(seconds)}`
          : `Saved to Google Drive under ${date}`}
      </p>

      <button
        type="button"
        onClick={status === "recording" ? stopRecording : startRecording}
        disabled={busy}
        className={[
          "flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition",
          status === "recording"
            ? "bg-rose-600 hover:bg-rose-500 text-white animate-pulse"
            : "bg-sky-500 hover:bg-sky-400 text-white",
          busy ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
      >
        {status === "recording" ? (
          <Square className="w-4 h-4 fill-current" />
        ) : busy ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
        <span>
          {status === "recording" ? "Stop" : busy ? "Transcribing & saving…" : "Start recording"}
        </span>
      </button>

      {status === "done" && (
        <p className="flex items-center gap-2 text-emerald-400 text-xs">
          <CheckCircle2 className="w-4 h-4" /> Transcribed and uploaded.
        </p>
      )}

      {error && (
        <p className="flex items-center gap-2 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
    </div>
  );
}
