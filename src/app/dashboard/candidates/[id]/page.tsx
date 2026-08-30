import Link from 'next/link';
import { ArrowLeft, Download, Eye, MessageSquare, ThumbsUp, AlertTriangle } from 'lucide-react';
import ScoreCircle from '@/components/ScoreCircle';
import styles from './page.module.css';

const transcript = [
  { speaker: 'AI', text: 'Welcome! Thank you for joining this interview for the Senior React Developer role. Could you start by telling me about your experience with React?' },
  { speaker: 'Candidate', text: 'Sure! I have been working with React for over 4 years now. I started with class components and have since transitioned fully to hooks and functional components.' },
  { speaker: 'AI', text: 'Great experience! Can you walk me through how you would design a large-scale state management solution for a complex dashboard application?' },
  { speaker: 'Candidate', text: 'I would evaluate the complexity first. For moderate state, React Context with useReducer works well. For complex apps, I prefer Zustand or Redux Toolkit because of their middleware support and devtools integration.' },
  { speaker: 'AI', text: 'Excellent answer. Now, tell me about a challenging bug you solved recently and your debugging approach.' },
  { speaker: 'Candidate', text: 'Recently we had a memory leak caused by an event listener not being cleaned up in a useEffect. I used Chrome DevTools heap snapshots to identify the retained objects and added proper cleanup functions.' },
];

const behavioralTags = [
  { label: 'Maintained good eye contact', positive: true },
  { label: 'Confident body language', positive: true },
  { label: 'Clear and articulate speech', positive: true },
  { label: 'Brief hesitation on system design', positive: false },
  { label: 'Engaged and attentive', positive: true },
];

export default function CandidateAnalyticsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/dashboard/jobs/1" className={styles.backBtn}>
          <ArrowLeft size={18} />
        </Link>
        <div className={styles.headerInfo}>
          <h1 className={styles.title}>Vikram Das</h1>
          <p className={styles.subtitle}>Senior React Developer · Interview Completed</p>
        </div>
        <button className="btn btn-secondary btn-sm">
          <Download size={14} /> Export Report
        </button>
      </div>

      <div className={styles.layout}>
        {/* Left Column - Video & Transcript */}
        <div className={styles.leftCol}>
          <div className={styles.videoPlayer}>
            <div className={styles.videoPlaceholder}>
              <div className={styles.playIcon}>▶</div>
              <p>Interview Recording</p>
              <span>Duration: 18:24</span>
            </div>
          </div>

          <div className={styles.transcriptSection}>
            <h3 className={styles.sectionTitle}>
              <MessageSquare size={16} /> Interview Transcript
            </h3>
            <div className={styles.transcriptList}>
              {transcript.map((msg, i) => (
                <div key={i} className={`${styles.message} ${msg.speaker === 'AI' ? styles.messageAI : styles.messageCandidate}`}>
                  <span className={styles.speaker}>{msg.speaker === 'AI' ? '🤖 AI Interviewer' : '👤 Candidate'}</span>
                  <p className={styles.messageText}>{msg.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Scores & Insights */}
        <div className={styles.rightCol}>
          <div className={styles.scoreCard}>
            <h3 className={styles.sectionTitle}>Overall Score</h3>
            <div className={styles.scoreCenter}>
              <ScoreCircle score={91} size={140} label="Excellent" />
            </div>
          </div>

          <div className={styles.metricsCard}>
            <h3 className={styles.sectionTitle}>Skill Breakdown</h3>
            <div className={styles.metricsList}>
              {[
                { label: 'Technical Knowledge', score: 95 },
                { label: 'Communication', score: 88 },
                { label: 'Problem Solving', score: 90 },
                { label: 'Culture Fit', score: 85 },
              ].map((m) => (
                <div key={m.label} className={styles.metricItem}>
                  <div className={styles.metricHeader}>
                    <span>{m.label}</span>
                    <span className={styles.metricScore}>{m.score}/100</span>
                  </div>
                  <div className={styles.metricBar}>
                    <div className={styles.metricFill} style={{ width: `${m.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.behaviorCard}>
            <h3 className={styles.sectionTitle}>
              <Eye size={16} /> Behavioral Analysis
            </h3>
            <div className={styles.tagList}>
              {behavioralTags.map((tag, i) => (
                <div key={i} className={`${styles.tag} ${tag.positive ? styles.tagPositive : styles.tagNegative}`}>
                  {tag.positive ? <ThumbsUp size={12} /> : <AlertTriangle size={12} />}
                  {tag.label}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.recommendationCard}>
            <span className={`badge badge-success`} style={{ fontSize: '0.85rem', padding: '6px 16px' }}>
              ✅ AI Recommendation: STRONG HIRE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
