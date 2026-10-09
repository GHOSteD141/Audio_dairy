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
3. Set `NEXTAUTH_URL` to your production URL, e.g. `https://your-app.vercel.app`.
4. Add the production redirect URI in Google Cloud Console:
   `https://your-app.vercel.app/api/auth/callback/google`.
5. Deploy. Any remaining values (the Groq key / model) can be set from the
   in-app **Settings** page after signing in.

## Project structure

```
app/
  api/auth/[...nextauth]/route.ts   # NextAuth handler
  api/diary/record/route.ts         # POST: transcribe + upload
  api/diary/entries/route.ts        # GET : recorded date list
  api/diary/entries/[date]/route.ts # GET : entry JSON (and ?audio=true stream)
  api/settings/route.ts             # GET/PUT: in-app settings (Drive config.json)
  settings/page.tsx                 # settings UI
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
