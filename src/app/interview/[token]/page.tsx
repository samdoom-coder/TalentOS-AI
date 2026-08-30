'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Mic, MicOff, PhoneOff, AlertCircle, Loader2, Video } from 'lucide-react';
import AiAvatar from '@/components/AiAvatar';
import { useWebcam } from '@/hooks/useWebcam';
import styles from './page.module.css';

interface Message {
  speaker: 'AI' | 'Candidate';
  text: string;
  timestamp: number;
}

interface InterviewData {
  interviewId: string;
  candidate: { name: string; email: string };
  job: { title: string; description: string };
  persona: { name: string; role: string; color: string; systemPrompt: string | null };
  company: { name: string; strictness: string };
  resumeContext?: string | null;
}

type InterviewState = 'loading' | 'error' | 'ready' | 'active' | 'listening' | 'processing' | 'speaking' | 'completed';

export default function InterviewRoomPage() {
  const { token } = useParams();
  const { videoRef, startWebcam, stopWebcam } = useWebcam();

  const [state, setState] = useState<InterviewState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [data, setData] = useState<InterviewData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');

  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Validate token on mount
  useEffect(() => {
    async function validate() {
      try {
        const res = await fetch('/api/interview/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setData(json);
        setState('ready');
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Invalid interview link');
        setState('error');
      }
    }
    validate();
  }, [token]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Timer
  useEffect(() => {
    if (['active', 'listening', 'processing', 'speaking'].includes(state)) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  };

  // === TTS: Speak using browser SpeechSynthesis with lip-sync ===
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;

      // Pick a good voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v =>
        v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Samantha')
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.rate = 1;
      utterance.pitch = 1;

      // Set up audio analysis for lip-sync
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      // Create oscillator to approximate speech for analyser (since SpeechSynthesis doesn't expose audio stream)
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.frequency.value = 200;
      gainNode.gain.value = 0; // Silent — we just use analyser for animation
      oscillator.connect(gainNode);
      gainNode.connect(analyser);
      analyser.connect(ctx.destination);

      // Simulate amplitude changes based on speech timing
      let animFrame: number;
      const simulateLipSync = () => {
        // Create artificial amplitude data for the analyser
        const dataArray = new Uint8Array(analyser.fftSize);
        // Simulate mouth movement with noise
        for (let i = 0; i < dataArray.length; i++) {
          dataArray[i] = 128 + Math.random() * 60 - 30;
        }
        // Write to analyser via oscillator frequency modulation
        oscillator.frequency.value = 150 + Math.random() * 200;
        gainNode.gain.value = 0.001; // Very faint — just enough for analyser
        animFrame = requestAnimationFrame(simulateLipSync);
      };

      utterance.onstart = () => {
        setIsSpeaking(true);
        oscillator.start();
        analyserRef.current = analyser;
        simulateLipSync();
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        analyserRef.current = null;
        oscillator.stop();
        cancelAnimationFrame(animFrame);
        gainNode.disconnect();
        resolve();
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        analyserRef.current = null;
        try { oscillator.stop(); } catch { /* already stopped */ }
        cancelAnimationFrame(animFrame);
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  // === STT: Listen using browser SpeechRecognition ===
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setLiveTranscript(final || interim);
    };

    recognition.onend = async () => {
      const text = liveTranscriptRef.current;
      setLiveTranscript('');
      if (!text || text.trim() === '') {
        setState('active');
        return;
      }

      // Add candidate message
      const candidateMsg: Message = { speaker: 'Candidate', text, timestamp: Date.now() };
      setMessages(prev => [...prev, candidateMsg]);
      historyRef.current.push({ role: 'user', content: text });

      // Get AI response
      setState('processing');
      try {
        const res = await fetch('/api/interview/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateText: text,
            history: historyRef.current,
            systemPrompt: data?.persona.systemPrompt,
            jobTitle: data?.job.title,
            candidateName: data?.candidate.name,
            companyName: data?.company.name,
            strictnessLevel: data?.company.strictness,
            resumeContext: data?.resumeContext,
          }),
        });
        const json = await res.json();

        if (json.aiText) {
          const aiMsg: Message = { speaker: 'AI', text: json.aiText, timestamp: Date.now() };
          setMessages(prev => [...prev, aiMsg]);
          historyRef.current.push({ role: 'assistant', content: json.aiText });

          // Speak the response
          setState('speaking');
          await speak(json.aiText);
        }
      } catch (err) {
        console.error('Process error:', err);
      }
      setState('active');
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('STT Error:', event.error);
      setState('active');
    };

    setState('listening');
    recognition.start();
  }, [data, speak]);

  // Keep a ref to liveTranscript so onend can access the latest value
  const liveTranscriptRef = useRef('');
  useEffect(() => { liveTranscriptRef.current = liveTranscript; }, [liveTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // Start the interview
  const handleStart = async () => {
    await startWebcam();
    // Load voices (needed on some browsers)
    window.speechSynthesis.getVoices();
    setState('active');

    const greeting = `Hello ${data?.candidate.name}! Welcome to your interview for the ${data?.job.title} position. I'm ${data?.persona.name}, and I'll be conducting your interview today. When you're ready, tap the microphone button and introduce yourself.`;
    const msg: Message = { speaker: 'AI', text: greeting, timestamp: Date.now() };
    setMessages([msg]);
    historyRef.current.push({ role: 'assistant', content: greeting });

    // Speak greeting
    setState('speaking');
    await speak(greeting);
    setState('active');
  };

  // End interview
  const handleEnd = async () => {
    recognitionRef.current?.stop();
    window.speechSynthesis.cancel();
    stopWebcam();
    if (timerRef.current) clearInterval(timerRef.current);
    setState('processing');

    try {
      await fetch('/api/interview/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: data?.interviewId,
          transcript: messages,
        }),
      });
    } catch (err) {
      console.error('Complete error:', err);
    }

    setState('completed');
  };

  // Mic toggle handler
  const handleMicToggle = () => {
    if (state === 'listening') {
      stopListening();
    } else if (state === 'active') {
      startListening();
    }
  };

  // === RENDER STATES ===

  if (state === 'error') {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <AlertCircle size={48} className={styles.errorIcon} />
          <h1>Invalid Interview Link</h1>
          <p>{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className={styles.container}>
        <Loader2 size={32} className={styles.spinner} />
        <p style={{ color: 'var(--text-muted)', marginTop: '16px' }}>Validating interview link...</p>
      </div>
    );
  }

  if (state === 'completed') {
    return (
      <div className={styles.container}>
        <div className={styles.completedCard}>
          <div className={styles.completedIcon}>✅</div>
          <h1>Interview Completed!</h1>
          <p>Thank you, {data?.candidate.name}. Your interview has been recorded and will be evaluated by our AI system.</p>
          <p className={styles.completedSub}>You will receive the results via email shortly.</p>
        </div>
      </div>
    );
  }

  if (state === 'ready') {
    return (
      <div className={styles.container}>
        <div className={styles.readyCard}>
          <AiAvatar
            name={data?.persona.name || 'AI'}
            role={data?.persona.role}
            color={data?.persona.color}
            isSpeaking={false}
            analyserNode={null}
          />
          <h1 className={styles.readyTitle}>Ready for your Interview?</h1>
          <p className={styles.readyText}>Position: <strong>{data?.job.title}</strong></p>
          <p className={styles.readyHints}>
            • Make sure your camera and microphone are enabled<br />
            • Use Chrome or Edge for best speech recognition<br />
            • Find a quiet, well-lit environment
          </p>
          <button className={`btn btn-primary btn-lg ${styles.startBtn}`} onClick={handleStart}>
            <Video size={20} /> Start Interview
          </button>
        </div>
      </div>
    );
  }

  // ACTIVE / LISTENING / PROCESSING / SPEAKING
  return (
    <div className={styles.room}>
      <div className={styles.topBar}>
        <span className={styles.jobLabel}>{data?.job.title}</span>
        <span className={styles.timer}>{formatTime(elapsed)}</span>
        <button className={`btn btn-sm ${styles.endBtn}`} onClick={handleEnd}>
          <PhoneOff size={16} /> End Interview
        </button>
      </div>

      <div className={styles.mainLayout}>
        <div className={styles.avatarSection}>
          <AiAvatar
            name={data?.persona.name || 'AI'}
            role={data?.persona.role}
            color={data?.persona.color}
            isSpeaking={isSpeaking}
            analyserNode={analyserRef.current}
          />
        </div>

        <div className={styles.transcript}>
          <h3 className={styles.transcriptTitle}>Live Transcript</h3>
          <div className={styles.transcriptList}>
            {messages.map((msg, i) => (
              <div key={i} className={`${styles.msg} ${msg.speaker === 'AI' ? styles.msgAi : styles.msgCandidate}`}>
                <span className={styles.msgSpeaker}>
                  {msg.speaker === 'AI' ? `🤖 ${data?.persona.name}` : '👤 You'}
                </span>
                <p className={styles.msgText}>{msg.text}</p>
              </div>
            ))}
            {liveTranscript && (
              <div className={`${styles.msg} ${styles.msgCandidate} ${styles.msgLive}`}>
                <span className={styles.msgSpeaker}>👤 You (listening...)</span>
                <p className={styles.msgText}>{liveTranscript}</p>
              </div>
            )}
            {state === 'processing' && (
              <div className={styles.processingIndicator}>
                <Loader2 size={16} className={styles.spinner} /> AI is thinking...
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.webcamPreview}>
          <video ref={videoRef} className={styles.webcamVideo} muted playsInline />
        </div>

        <button
          className={`${styles.micBtn} ${state === 'listening' ? styles.micBtnActive : ''}`}
          onClick={handleMicToggle}
          disabled={state === 'processing' || state === 'speaking'}
        >
          {state === 'listening' ? <MicOff size={24} /> : <Mic size={24} />}
        </button>

        <span className={styles.micHint}>
          {state === 'speaking' ? '🔊 AI is speaking...'
            : state === 'listening' ? '🎤 Listening — tap to send'
            : state === 'processing' ? '⏳ Processing...'
            : '🎙 Tap mic to speak'}
        </span>
      </div>
    </div>
  );
}

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
