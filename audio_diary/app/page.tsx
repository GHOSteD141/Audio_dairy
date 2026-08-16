'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Settings as SettingsIcon, Square, Play, Pause, 
  ChevronDown, ChevronUp, Download, HardDrive, BrainCircuit, Target, 
  Activity, Tag, CheckCircle2, Circle, Laptop, HelpCircle, UserCheck, AlertTriangle, X
} from 'lucide-react';

interface JournalEntry {
  id: string;
  timestamp: number;
  dateStr: string;
  dayFormatted: string;
  monthYearStr: string;
  title: string;
  glyph: 'desk' | 'relax' | 'sleep' | 'nature' | 'idea';
  transcript: string;
  audioUrl?: string;
  feedback: string | null;
  moodScore: number | null;
  moodLabel: string | null;
  tags: string[];
}

interface Goal {
  id: string;
  text: string;
  completed: boolean;
}

export default function AudioDiaryClone() {
  // Navigation & UI State
  const [currentView, setCurrentView] = useState<'main' | 'settings'>('main');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMonthExpanded, setIsMonthExpanded] = useState(true);

  // Storage Target: 'local' | 'drive' | 'both' | ''
  const [storageTarget, setStorageTarget] = useState<string>('');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [driveFolder, setDriveFolder] = useState('AudioDiary_Vault/Recordings');

  // Intelligence Provider & API Keys
  const [provider, setProvider] = useState('google');
  const [apiKey, setApiKey] = useState('');
  const [skipApiWarning, setSkipApiWarning] = useState(false);

  // Guard Modals State
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showDriveAuthModal, setShowDriveAuthModal] = useState(false);
  const [showApiWarningModal, setShowApiWarningModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // Audio Recording & Web Speech State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>([15, 25, 40, 20, 35]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [liveSpeechTranscript, setLiveSpeechTranscript] = useState('');

  // App Data
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  useEffect(() => {
    const savedStorage = localStorage.getItem('ad_storage_target') || '';
    setStorageTarget(savedStorage);

    const isConnected = localStorage.getItem('gdrive_connected') === 'true';
    setGoogleConnected(isConnected);

    const savedKey = localStorage.getItem(`${provider}_api_key`) || '';
    setApiKey(savedKey);

    const isWarningSkipped = localStorage.getItem('ad_skip_api_warning') === 'true';
    setSkipApiWarning(isWarningSkipped);

    const savedEntries = localStorage.getItem('ad_entries_v4');
    if (savedEntries) setEntries(JSON.parse(savedEntries));

    const savedGoals = localStorage.getItem('ad_goals_v4');
    if (savedGoals) setGoals(JSON.parse(savedGoals));

    // Handle OAuth Callback Params if present
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('auth_success') === 'true') {
        setGoogleConnected(true);
        localStorage.setItem('gdrive_connected', 'true');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [provider]);

  // Handle Google OAuth Redirect
  const handleGoogleLoginRedirect = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
    const redirectUri = typeof window !== 'undefined' ? `${window.location.origin}/?auth_success=true` : '';
    const scope = 'https://www.googleapis.com/auth/drive.file';

    if (clientId === 'YOUR_GOOGLE_CLIENT_ID') {
      // Mock OAuth redirect fallback for development environments
      localStorage.setItem('gdrive_connected', 'true');
      setGoogleConnected(true);
      return;
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=token&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    window.location.href = authUrl;
  };

  const handleStorageTargetChange = (target: string) => {
    setStorageTarget(target);
    localStorage.setItem('ad_storage_target', target);
  };

  // Pre-recording Configuration Guards
  const handleStartSessionClick = () => {
    // 1. Storage Selection Guard
    if (!storageTarget) {
      setModalMessage('Storage destination is unselected. Select Local Device, Google Drive, or Both in Settings before recording.');
      setShowStorageModal(true);
      return;
    }

    // 2. Google Drive Connection Guard
    if ((storageTarget === 'drive' || storageTarget === 'both') && !googleConnected) {
      setModalMessage('Google Drive storage is enabled, but your Google Account is not connected.');
      setShowDriveAuthModal(true);
      return;
    }

    // 3. API Key Check Guard (Prompt once per browser cache state)
    if (!apiKey && !skipApiWarning) {
      setShowApiWarningModal(true);
      return;
    }

    initiateAudioRecording();
  };

  const handleContinueWithoutApi = () => {
    localStorage.setItem('ad_skip_api_warning', 'true');
    setSkipApiWarning(true);
    setShowApiWarningModal(false);
    initiateAudioRecording();
  };

  // Real-time Visualizer Setup
  const startAudioVisualizer = (stream: MediaStream) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = audioContext;
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    analyser.fftSize = 32;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVisualizer = () => {
      analyser.getByteFrequencyData(dataArray);
      const normalized = Array.from(dataArray.slice(0, 5)).map(v => Math.max(12, Math.min(65, v / 3)));
      setAudioLevels(normalized);
      animFrameRef.current = requestAnimationFrame(updateVisualizer);
    };
    updateVisualizer();
  };

  // Web Speech Recognition Integration
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let accumulated = '';
      recognition.onresult = (event: any) => {
        let current = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          current += event.results[i][0].transcript;
        }
        accumulated = current;
        setLiveSpeechTranscript(accumulated);
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
    }
  };

  const initiateAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startAudioVisualizer(stream);
      setLiveSpeechTranscript('');
      startSpeechRecognition();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Microphone access denied or unavailable.');
    }
  };

  const stopRecordingAndProcess = async () => {
    if (!mediaRecorderRef.current) return;

    setIsRecording(false);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current) audioCtxRef.current.close();
    if (speechRecognitionRef.current) speechRecognitionRef.current.stop();

    setIsProcessing(true);

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());

    mediaRecorderRef.current.onstop = async () => {
      const blobType = mediaRecorderRef.current?.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: blobType });

      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const finalSpokenText = liveSpeechTranscript.trim();

        let apiResult: any = null;

        if (apiKey) {
          try {
            const res = await fetch('/api/analyze', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-provider': provider,
                'x-api-key': apiKey,
              },
              body: JSON.stringify({ transcript: finalSpokenText }),
            });
            const data = await res.json();
            apiResult = data.result;
          } catch (e) {
            console.error(e);
          }
        }

        const fallbackDescription = "Cannot be described as Gemini API or any API key is not connected.";
        const now = new Date();
        const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
        const dayNum = now.getDate();
        const suffix = ['th', 'st', 'nd', 'rd'][(dayNum % 10 > 3 || Math.floor((dayNum % 100) / 10) === 1) ? 0 : dayNum % 10];

        const newEntry: JournalEntry = {
          id: Date.now().toString(),
          timestamp: now.getTime(),
          dateStr: now.toISOString(),
          dayFormatted: `${dayName} ${dayNum}${suffix}`,
          monthYearStr: now.toLocaleDateString('en-US', { month: 'long' }),
          title: apiResult?.title || (finalSpokenText ? "Voice Log" : "Silent Recording"),
          glyph: apiResult?.glyph || 'desk',
          transcript: finalSpokenText,
          audioUrl: base64Audio,
          feedback: apiKey ? (apiResult?.feedback || fallbackDescription) : fallbackDescription,
          moodScore: apiResult?.moodScore || null,
          moodLabel: apiResult?.moodLabel || null,
          tags: apiResult?.tags || ['Voice Log'],
        };

        const updatedEntries = [newEntry, ...entries];
        setEntries(updatedEntries);
        localStorage.setItem('ad_entries_v4', JSON.stringify(updatedEntries));

        if (apiResult?.goals?.length > 0) {
          const addedGoals: Goal[] = apiResult.goals.map((g: string) => ({
            id: Math.random().toString(),
            text: g,
            completed: false,
          }));
          const updatedGoals = [...addedGoals, ...goals];
          setGoals(updatedGoals);
          localStorage.setItem('ad_goals_v4', JSON.stringify(updatedGoals));
        }

        setIsProcessing(false);
      };
    };
  };

  // Convert Base64 data to Blob URL to fix NotSupportedError audio playback
  const playAudio = (id: string, base64DataUrl?: string) => {
    if (!base64DataUrl) return;

    if (currentlyPlayingId === id) {
      audioElementRef.current?.pause();
      setCurrentlyPlayingId(null);
      return;
    }

    try {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }

      const arr = base64DataUrl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'audio/webm';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const objectUrl = URL.createObjectURL(blob);

      const audio = new Audio(objectUrl);
      audioElementRef.current = audio;
      audio.play();
      setCurrentlyPlayingId(id);

      audio.onended = () => {
        setCurrentlyPlayingId(null);
        URL.revokeObjectURL(objectUrl);
      };
    } catch (err) {
      alert('Failed to play audio file format.');
    }
  };

  const toggleGoal = (id: string) => {
    const updated = goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g);
    setGoals(updated);
    localStorage.setItem('ad_goals_v4', JSON.stringify(updated));
  };

  const handleExportDiary = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(entries, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `AudioDiary_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredEntries = entries.filter(e => 
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.transcript.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.feedback && e.feedback.toLowerCase().includes(searchQuery.toLowerCase())) ||
    e.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderGlyphIcon = (type: string) => {
    switch (type) {
      case 'desk':
        return (
          <svg className="w-6 h-6 stroke-sky-400 fill-none" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        );
      case 'relax':
        return (
          <svg className="w-6 h-6 stroke-sky-400 fill-none" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12a8 8 0 11-16 0 8 8 0 0116 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6 stroke-sky-400 fill-none" viewBox="0 0 24 24" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" d="M9 10h.01M15 10h.01M9 15c1.5 1 4.5 1 6 0" />
          </svg>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#06090e] text-slate-100 font-sans pb-32">
      <header className="px-6 py-5 flex justify-between items-center max-w-xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-sky-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">
          AudioDiary
        </h1>
        <button 
          onClick={() => setCurrentView(currentView === 'main' ? 'settings' : 'main')} 
          className="p-2.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </header>

      {/* VIEW: SETTINGS */}
      {currentView === 'settings' ? (
        <main className="max-w-xl mx-auto px-4 space-y-6 mt-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-white">Profile & Settings</h2>
            <button 
              onClick={() => setCurrentView('main')} 
              className="text-xs text-sky-400 font-medium hover:underline"
            >
              ← Back to Diary
            </button>
          </div>

          <div className="bg-[#0e131f] border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            {/* Storage Selection Settings */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-sky-400" /> Storage Destination Required
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'local', label: 'Local Only' },
                  { id: 'drive', label: 'Google Drive' },
                  { id: 'both', label: 'Both' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleStorageTargetChange(opt.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                      storageTarget === opt.id
                        ? 'bg-sky-600 border-sky-400 text-white'
                        : 'bg-[#070a10] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Google Drive Integration */}
            <div className="space-y-4 border-t border-slate-800/80 pt-5">
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-sky-400" /> Google Drive Sync
              </h4>
              
              <div className="bg-[#070a10] border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-medium">Account Status</span>
                  {googleConnected ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> Connected
                      </span>
                      <button 
                        onClick={() => {
                          setGoogleConnected(false);
                          localStorage.setItem('gdrive_connected', 'false');
                        }}
                        className="text-[10px] text-slate-400 hover:text-rose-400 underline"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={handleGoogleLoginRedirect}
                      className="text-xs bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-lg font-medium transition"
                    >
                      Login through Google
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Target Storage Folder</label>
                  <input 
                    type="text" 
                    value={driveFolder} 
                    onChange={(e) => setDriveFolder(e.target.value)}
                    className="w-full bg-[#0e131f] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* AI Provider Settings */}
            <div className="space-y-3 border-t border-slate-800/80 pt-5">
              <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-indigo-400" /> Intelligence Provider
              </h4>
              <div className="flex gap-2">
                {['google', 'openai', 'anthropic'].map((p) => (
                  <button 
                    key={p} 
                    onClick={() => setProvider(p)} 
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize border transition ${
                      provider === p 
                        ? 'bg-sky-600 text-white border-sky-400' 
                        : 'bg-[#070a10] text-slate-400 border-slate-800'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input 
                type="password" 
                placeholder={`Enter ${provider.toUpperCase()} API Key`} 
                value={apiKey} 
                onChange={(e) => {
                  setApiKey(e.target.value);
                  localStorage.setItem(`${provider}_api_key`, e.target.value);
                }} 
                className="w-full bg-[#070a10] border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-sky-500" 
              />
            </div>
          </div>

          <div className="bg-[#0e131f] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/50 text-emerald-400">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Export diary</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Download structured diary entries to JSON.
                </p>
              </div>
            </div>
            <button 
              onClick={handleExportDiary}
              className="w-full mt-2 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition"
            >
              <Download className="w-4 h-4 text-emerald-400" /> Export JSON Archive
            </button>
          </div>
        </main>
      ) : (
        /* MAIN FEED */
        <main className="max-w-xl mx-auto px-4 space-y-6 mt-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
            <input 
              type="text" 
              placeholder="Search your diary" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0e131f] border border-slate-800/90 rounded-2xl py-3 pl-11 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 shadow-inner"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0e131f] border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" /> Ongoing Goals
                </span>
                <span className="text-[10px] bg-sky-950 text-sky-300 px-2 py-0.5 rounded-full font-mono">
                  {goals.filter(g => !g.completed).length}
                </span>
              </div>
              <div className="space-y-1.5 max-h-24 overflow-y-auto">
                {goals.filter(g => !g.completed).slice(0, 3).map(g => (
                  <div key={g.id} onClick={() => toggleGoal(g.id)} className="flex items-center gap-2 cursor-pointer group">
                    <Circle className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 shrink-0" />
                    <span className="text-[11px] text-slate-300 truncate">{g.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0e131f] border border-slate-800 rounded-2xl p-4 space-y-2">
              <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Mood Log
              </span>
              {entries.length > 0 && entries[0].moodLabel ? (
                <div>
                  <div className="text-lg font-bold text-white">{entries[0].moodLabel}</div>
                  <div className="text-[10px] text-slate-400">Score: {entries[0].moodScore}/10</div>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 italic mt-2">No mood logs</p>
              )}
            </div>
          </div>

          <div className="pt-2">
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-sky-400">Timeline</h2>
                <span className="text-xs text-slate-400 font-medium">• {filteredEntries.length} entries</span>
              </div>
              <button 
                onClick={() => setIsMonthExpanded(!isMonthExpanded)} 
                className="p-1 rounded-full bg-sky-500 text-white hover:bg-sky-400 transition"
              >
                {isMonthExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isMonthExpanded && (
            <div className="space-y-4 pt-2 relative">
              {filteredEntries.map((entry) => (
                <div key={entry.id} className="bg-[#0e131f] border border-slate-800 rounded-2xl p-5 shadow-lg relative flex items-center justify-between">
                  <div className="space-y-1.5 pr-4 flex-1">
                    <div className="text-xs font-semibold text-sky-400">{entry.dayFormatted}</div>
                    <h3 className="text-lg font-bold text-white tracking-tight leading-snug">
                      {entry.title}
                    </h3>
                    <p className="text-xs text-slate-300 italic">
                      {entry.transcript ? `"${entry.transcript}"` : entry.feedback}
                    </p>
                    {entry.feedback && entry.transcript && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        {entry.feedback}
                      </p>
                    )}

                    {entry.audioUrl && (
                      <div className="pt-2 flex items-center gap-2">
                        <button 
                          onClick={() => playAudio(entry.id, entry.audioUrl)}
                          className="px-3 py-1 rounded-full bg-sky-950 border border-sky-800 text-sky-400 text-xs flex items-center gap-1.5 hover:bg-sky-900 transition"
                        >
                          {currentlyPlayingId === entry.id ? (
                            <><Pause className="w-3 h-3" /> Pause Voice</>
                          ) : (
                            <><Play className="w-3 h-3" /> Play Audio Record</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="w-14 h-14 rounded-full bg-slate-900/90 border border-slate-800 flex items-center justify-center shrink-0">
                    {renderGlyphIcon(entry.glyph)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* STORAGE SELECTION & GOOGLE AUTH GUARD MODALS */}
      {showStorageModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e131f] border border-rose-800/80 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Storage Selection Required</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{modalMessage}</p>
            <button 
              onClick={() => {
                setShowStorageModal(false);
                setCurrentView('settings');
              }}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold transition"
            >
              Open Settings & Select Storage
            </button>
          </div>
        </div>
      )}

      {showDriveAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e131f] border border-rose-800/80 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Google Drive Not Connected</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{modalMessage}</p>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setShowDriveAuthModal(false);
                  setCurrentView('settings');
                }}
                className="flex-1 py-2 bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold"
              >
                Go to Settings
              </button>
              <button 
                onClick={() => {
                  setShowDriveAuthModal(false);
                  handleGoogleLoginRedirect();
                }}
                className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold"
              >
                Connect Google
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MISSING API KEY WARNING MODAL */}
      {showApiWarningModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e131f] border border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Missing API Key</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              You have not selected any AI or Gemini API key. None of your recordings will be processed through an AI.
            </p>
            <div className="space-y-2">
              <button 
                onClick={handleContinueWithoutApi}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition"
              >
                Continue Without AI
              </button>
              <button 
                onClick={() => {
                  setShowApiWarningModal(false);
                  setCurrentView('settings');
                }}
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold transition"
              >
                Add Gemini Key in Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORDING OVERLAY */}
      {isRecording && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 flex flex-col items-center justify-center p-6 space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-white">Listening to your thoughts...</h3>
            <p className="text-xs text-sky-400 font-mono">
              {Math.floor(recordingTime / 60)}:{('0' + (recordingTime % 60)).slice(-2)}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 h-20 px-8 py-4 bg-slate-900/90 border border-slate-800 rounded-full">
            {audioLevels.map((lvl, index) => (
              <div 
                key={index} 
                className="w-2.5 bg-linear-to-t from-sky-500 to-blue-300 rounded-full transition-all duration-75"
                style={{ height: `${lvl}px` }}
              />
            ))}
          </div>

          <button 
            onClick={stopRecordingAndProcess} 
            className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg transition animate-pulse"
          >
            <Square className="w-6 h-6 fill-current" />
          </button>
        </div>
      )}

      {/* START SESSION (+) BUTTON */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
        {isProcessing ? (
          <div className="w-16 h-16 rounded-full bg-slate-900 border border-sky-500 flex items-center justify-center animate-spin">
            <BrainCircuit className="w-7 h-7 text-sky-400" />
          </div>
        ) : (
          <button 
            onClick={handleStartSessionClick}
            className="w-16 h-16 rounded-full bg-linear-to-r from-sky-400 to-blue-500 hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-[0_0_25px_rgba(56,189,248,0.5)] transition-all"
          >
            <Plus className="w-9 h-9 stroke-[2.5]" />
          </button>
        )}
      </div>
    </div>
  );
}