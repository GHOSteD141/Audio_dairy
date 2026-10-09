import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service · Audio Diary",
  description: "The terms that govern your use of Audio Diary.",
};

const LAST_UPDATED = "October 10, 2026";
const CONTACT_EMAIL = "knightshnb@gmail.com";

export default function TermsPage() {
  return (
    <main className="flex-1 w-full max-w-3xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="w-7 h-7 text-sky-400" />
          <h1 className="text-xl font-bold text-white">Terms of Service</h1>
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
          By using Audio Diary (&ldquo;the app&rdquo;) you agree to these terms. If you do
          not agree, please do not use the app.
        </p>

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">Use of the app</h2>
          <p>
            Audio Diary is a personal voice-diary tool. You sign in with your Google
            account, record voice memos and the app stores the audio and its transcript in
            your own Google Drive. You must comply with Google&rsquo;s terms and any
            applicable laws when using it.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">Your content</h2>
          <p>
            You own everything you record. The app claims no ownership over your
            recordings, transcripts or settings. All of your content is stored in your own
            Google Drive, and you are responsible for keeping it.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">Availability</h2>
          <p>
            The app is provided &ldquo;as is&rdquo;, without warranties of any kind. It
            depends on third-party services (Google and Groq), so it may be unavailable or
            change at any time. We are not liable for any loss of data or damages arising
            from its use.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">Changes</h2>
          <p>
            We may update these terms from time to time. Continued use of the app after a
            change means you accept the updated terms.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">Contact</h2>
          <p>
            Questions about these terms? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-sky-400 hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </section>

      <p className="text-xs text-slate-500">
        See also:{" "}
        <Link href="/privacy" className="text-sky-400 hover:underline">
          Privacy Policy
        </Link>
      </p>
    </main>
  );
}
