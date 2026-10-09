# Audio Diary

A personal voice diary built with Next.js (App Router), TypeScript and Tailwind CSS.
Record daily voice memos in the browser; the audio is transcribed with **Groq Whisper**
(`whisper-large-v3`) and everything is stored privately in **your own Google Drive**
(no database required).

## How it works

```
Browser (MediaRecorder)
        │  POST multipart audio + date
        ▼
/api/diary/record  ──►  Groq Whisper (whisper-large-v3)  ──►  transcript
        │
        ▼
Google Drive (only files this app created — `drive.file` scope)
└── Audio Diary /
    ├── config.json                      # in-app settings (see below)
    └── DD-MM-YYYY /
        ├── recording_<timestamp>.webm   # the audio
        └── entry.json                   # transcript, date, timestamp, audio link
```

There is **no database**. Your recordings, transcripts and settings all live in a
folder in *your own* Google Drive, so the app can only ever touch the files it created.

1. **Authentication** — NextAuth's Google provider requests
   `openid email profile https://www.googleapis.com/auth/drive.file` with
   `access_type=offline` + `prompt=consent`. The OAuth access token is stored on the
   JWT and forwarded in the session so API routes can call the Drive API on your behalf.
   Expired tokens are transparently refreshed with the stored refresh token
   (`lib/auth.ts`).
2. **Recording** — `components/AudioRecorder.tsx` captures audio in the browser with
   `MediaRecorder` and `POST`s it as `multipart/form-data` to `/api/diary/record`.
3. **Transcription** — the route sends the audio to Groq's Whisper endpoint
   (`openai/v1/audio/transcriptions`) using the native `fetch`/`FormData`/`Blob` API,
   so no extra SDK is needed. The model is configurable (see Settings).
4. **Storage** — `lib/drive.ts` (via `googleapis`) finds/creates
   `Audio Diary / DD-MM-YYYY /`, uploads the audio file, then writes the companion
   `entry.json`. That JSON is what the UI reads back.
5. **Browsing** — `components/CalendarView.tsx` (built with `date-fns`) paints a month
   grid and marks days that have an entry. Selecting a day calls
   `/api/diary/entries/[date]`; the audio is streamed back through
   `/api/diary/entries/[date]?audio=true` for in-app playback.

## Configuration

There are two kinds of configuration.

### 1. In-app settings (changeable from `/settings`)

The Settings page (linked from the header) edits values that are only needed
*per request*. They are stored in **your own Google Drive** at
`Audio Diary / config.json`, so they sync across devices and require no database —
which is why this works on Vercel too.

| Setting | Purpose |
| --- | --- |
| **Groq API key** | Used to transcribe recordings. |
| **Whisper model** | Groq model id (default `whisper-large-v3`). |

Resolution order: **Drive `config.json` → environment variable → built-in default**.
You can therefore still use `GROQ_API_KEY`/`WHISPER_MODEL` in the environment, and
override them per-account from the UI.

### 2. Environment variables (required, not changeable in-app)

These are read when the server starts or during the OAuth flow, so they must be set
as environment variables (`.env.local` locally, or the project's Environment
Variables on Vercel):

| Variable | Notes |
| --- | --- |
| `GOOGLE_CLIENT_ID` | OAuth client id. |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret. |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32`. Must stay stable or every session is invalidated. |
| `NEXTAUTH_URL` | `http://localhost:3000` locally; your production URL on Vercel. |

> The Groq key **can** live in either place; the OAuth credentials and the NextAuth
> secret intentionally cannot be edited from the UI (they are needed before the server
> can start and are security-critical).

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create your env file** (copy the template)

   ```bash
   cp .env.local.example .env.local
   ```

   Fill in:
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` – from Google Cloud Console
   - `NEXTAUTH_SECRET` – `openssl rand -base64 32`
   - `NEXTAUTH_URL` – `http://localhost:3000`
   - `GROQ_API_KEY` – optional, from https://console.groq.com/keys
     (or set it later from the in-app Settings page)

3. **Google Cloud Console**
   - Enable the **Google Drive API**.
   - Configure the OAuth consent screen and add the scope
     `https://www.googleapis.com/auth/drive.file`.
   - Add an authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.

4. **Run**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000, sign in with Google, then record a memo.

## Deploying to Vercel

1. Push the repository to GitHub and import it in Vercel.
2. Add the environment variables from step 2 above (`GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, and optionally `GROQ_API_KEY`).
   **Set the scope of every variable to Production (and Preview).** By default
   Vercel may create them as *Development*-only, in which case a production
   deployment receives them as empty strings.
3. Set `NEXTAUTH_URL` to your production URL, e.g. `https://your-app.vercel.app`
   (no trailing slash — it must match the domain exactly).
4. Add the production redirect URI in Google Cloud Console:
   `https://your-app.vercel.app/api/auth/callback/google`.
5. Deploy. Any remaining values (the Groq key / model) can be set from the
   in-app **Settings** page after signing in.

> **Preview / branch URLs** get a different hostname (`*-<hash>-<team>.vercel.app`),
> which is not in the Google redirect URIs, so OAuth only works on the production
> domain. Add extra redirect URIs if you need preview sign-in.

### Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `[next-auth][error][NO_SECRET]` and `/api/auth/*` returns 500 | `NEXTAUTH_SECRET` is not visible to the production build (usually the variable is scoped to *Development* only). | Edit each variable in Vercel → Settings → Environment Variables, tick **Production**/**Preview**, then **Redeploy** (env changes need a fresh build). |
| `redirect_uri_mismatch` from Google | The redirect URI isn't registered, or `NEXTAUTH_URL` doesn't match the domain. | Add `https://<your-domain>/api/auth/callback/google` to the OAuth client and set `NEXTAUTH_URL` to the exact same origin. |
| Signed out after ~7 days | The OAuth app is in **Testing** publishing status, which expires external refresh tokens after 7 days. | Publish it: **Google Auth Platform → Audience → Publish app** (see [Leaving test mode](#leaving-test-mode) below). |

### Leaving test mode

While the OAuth app is in **Testing**, only allowlisted test users (max 100) can
sign in and their refresh tokens are revoked after **7 days**. To turn this off:

1. Open **Google Auth Platform → Audience** for your project:
   `https://console.cloud.google.com/auth/audience?project=<YOUR_PROJECT_ID>`
   (older console: **APIs & Services → OAuth consent screen**).
2. Under **Publishing status** (currently *Testing*) click **Publish app** and confirm.
3. The status becomes **In production**. Anyone with a Google account can now sign
   in and refresh tokens no longer expire weekly.

Because this app only requests **non-sensitive** scopes
(`openid`, `email`, `profile`, `.../auth/drive.file`), Google does **not** require a
verification review to publish — the change is immediate. (Brand verification is only
needed if you want your app name/logo shown on the consent screen, and scope
verification is only needed for *sensitive* or *restricted* scopes such as the full
`.../auth/drive`.) Existing sessions issued during Testing keep their 7-day limit;
sign out and back in to get a fresh token.

### Consent screen links (privacy policy & terms)

The **Branding** page of the OAuth consent screen (`Google Auth Platform → Branding`)
asks for an *Application home page* and an *Application privacy policy link*. These
must be **public URLs** (reachable without signing in). This repo ships both pages, so
use the deployed URLs:

| Consent-screen field | Value |
| --- | --- |
| Application home page | `https://audiodairy.vercel.app` |
| Application privacy policy link | `https://audiodairy.vercel.app/privacy` |
| Application terms of service link | `https://audiodairy.vercel.app/terms` |
| Authorized domain | `audiodairy.vercel.app` (no scheme/path) |

The policy text lives in [`app/privacy/page.tsx`](app/privacy/page.tsx) and the terms
in [`app/terms/page.tsx`](app/terms/page.tsx); both are linked from the dashboard
footer. Edit the `CONTACT_EMAIL` constant in each file if the contact address changes.
If your app is not at `audiodairy.vercel.app`, swap the host for your own domain
(and keep `NEXTAUTH_URL` in sync).

## Project structure

```
app/
  api/auth/[...nextauth]/route.ts   # NextAuth handler
  api/diary/record/route.ts         # POST: transcribe + upload
  api/diary/entries/route.ts        # GET : recorded date list
  api/diary/entries/[date]/route.ts # GET : entry JSON (and ?audio=true stream)
  api/settings/route.ts             # GET/PUT: in-app settings (Drive config.json)
  settings/page.tsx                 # settings UI
  privacy/page.tsx                  # public privacy policy (consent-screen link)
  terms/page.tsx                    # public terms of service (consent-screen link)
  layout.tsx                        # wraps the app in SessionProvider
  page.tsx                          # dashboard
components/
  AudioRecorder.tsx
  CalendarView.tsx
  Providers.tsx
lib/
  auth.ts      # NextAuth options (Google + Drive scope)
  drive.ts     # Google Drive helpers
  settings.ts  # read/write Audio Diary/config.json + Groq resolution
  types.ts     # shared DiaryEntry type
types/
  next-auth.d.ts  # session/JWT augmentation (accessToken)
```
