import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy · Audio Diary",
  description:
    "How Audio Diary handles your Google account data, voice recordings and transcripts.",
};

const LAST_UPDATED = "October 10, 2026";
const CONTACT_EMAIL = "knightshnb@gmail.com";

export default function PrivacyPolicyPage() {
  return (
    <main className="flex-1 w-full max-w-3xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-sky-400" />
          <h1 className="text-xl font-bold text-white">Privacy Policy</h1>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 text-sm font-medium transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6 text-sm leading-relaxed text-slate-300">
        <p className="text-xs text-slate-500">Last updated: {LAST_UPDATED}</p>

        <p>
          Audio Diary (&ldquo;the app&rdquo;) is a personal voice diary. Everything you
          record is stored in <strong className="text-white">your own Google Drive</strong>.
          This policy explains what data the app accesses and how it is used.
        </p>

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">Information we access</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong className="text-white">Google account basics</strong> — your name,
              email address and profile picture, provided by Google Sign-In.
            </li>
            <li>
              <strong className="text-white">Google Drive files</strong> — the app requests
              only the <code className="text-sky-400">drive.file</code> scope, so it can
              create and read <em>only the files it created itself</em>. It cannot see the
              rest of your Drive.
            </li>
            <li>
              <strong className="text-white">Your content</strong> — the voice recordings
              you make and the transcripts generated from them, plus your in-app settings
              (Groq API key and Whisper model).
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">How your data is stored</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Recordings, transcripts and settings live in an{" "}
              <span className="text-sky-400">Audio Diary</span> folder inside your Google
              Drive. There is no separate database.
            </li>
            <li>
              Google OAuth access and refresh tokens are kept in an encrypted session
              cookie (JWT) so the app can talk to Drive on your behalf.
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">
            Sharing with third parties
          </h2>
          <p>
            We do not sell your data and there is no advertising or analytics. Data is
            handled only by the services the app relies on:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong className="text-white">Google</strong> — sign-in and Drive storage.
            </li>
            <li>
              <strong className="text-white">Groq</strong> — recordings are sent to
              Groq&rsquo;s Whisper API to produce a transcript.
            </li>
            <li>
              <strong className="text-white">Vercel</strong> — hosts the web application.
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">Retention and deletion</h2>
          <p>
            You are always in control of your data. Delete the{" "}
            <span className="text-sky-400">Audio Diary</span> folder in your Drive to remove
            all recordings and transcripts, and revoke the app&rsquo;s access at{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:underline"
            >
              myaccount.google.com/permissions
            </a>
            .
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">Contact</h2>
          <p>
            Questions about this policy? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-sky-400 hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </section>

      <p className="text-xs text-slate-500">
        See also:{" "}
        <Link href="/terms" className="text-sky-400 hover:underline">
          Terms of Service
        </Link>
      </p>
    </main>
  );
}
