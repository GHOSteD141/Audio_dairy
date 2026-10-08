# Audio Diary

A personal voice diary built with Next.js (App Router), TypeScript and Tailwind CSS.
Record daily voice memos in the browser; the audio is transcribed with **Groq Whisper**
(`whisper-large-v3`) and everything is stored privately in **your own Google Drive**
(no database required).

## How it works

```
Google Drive
└── Audio Diary /
    └── DD-MM-YYYY /
        ├── recording_<timestamp>.webm   # the audio
        └── entry.json                   # transcript, date, timestamp, audio link
```

- **Auth**: `next-auth` with the Google provider, requesting
  `openid email profile https://www.googleapis.com/auth/drive.file` and offline access.
  The OAuth access token is forwarded to API routes so they can call the Drive API.
- **Storage**: `googleapis` writes the audio blob and companion `entry.json`.
- **Transcription**: Groq's Whisper REST endpoint (`whisper-large-v3`) called with the
  native `fetch`/`FormData`/`Blob` globals — no extra SDK required.
- **UI**: in-browser `MediaRecorder`, a `date-fns` monthly calendar that highlights
  recorded days, and an entry viewer with playback.

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
   - `GROQ_API_KEY` – from https://console.groq.com/keys
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` – from Google Cloud Console
   - `NEXTAUTH_SECRET` – `openssl rand -base64 32`
   - `NEXTAUTH_URL` – `http://localhost:3000`

3. **Google Cloud Console**
   - Enable the **Google Drive API**.
   - Configure the OAuth consent screen and add the scope
     `https://www.googleapis.com/auth/drive.file`.
   - Add an authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.

4. **Run**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 and sign in with Google.

## Project structure

```
app/
  api/auth/[...nextauth]/route.ts   # NextAuth handler
  api/diary/record/route.ts         # POST: transcribe + upload
  api/diary/entries/route.ts        # GET : recorded date list
  api/diary/entries/[date]/route.ts # GET : entry JSON (and ?audio=true stream)
  layout.tsx                        # wraps the app in SessionProvider
  page.tsx                          # dashboard
components/
  AudioRecorder.tsx
  CalendarView.tsx
  Providers.tsx
lib/
  auth.ts     # NextAuth options (Google + Drive scope)
  drive.ts    # Google Drive helpers
  types.ts    # shared DiaryEntry type
types/
  next-auth.d.ts  # session/JWT augmentation (accessToken)
```
