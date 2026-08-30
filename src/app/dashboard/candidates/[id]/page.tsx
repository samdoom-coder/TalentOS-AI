'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, MessageSquare, ThumbsUp, AlertTriangle, Loader2, FileText, Eye } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import ScoreCircle from '@/components/ScoreCircle';
import CVAnalyticsCards from '@/components/CVAnalyticsCards';
import CVRadarChart from '@/components/CVRadarChart';
import InterviewRadarCharts from '@/components/InterviewRadarCharts';
import styles from './page.module.css';
import type { CVAnalytics } from '@/lib/types';

interface CandidateData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  job_id: string;
  resume_url: string | null;
  jobs: { title: string } | null;
  resume_screenings: {
    match_score: number;
    identified_skills: string[];
    missing_skills: string[];
    summary: string | null;
    cv_analytics?: CVAnalytics | null;
  } | null;
  interviews: {
    id: string;
    status: string;
    transcript: { speaker: string; text: string; timestamp: number }[] | null;
    actual_start: string | null;
    actual_end: string | null;
    interview_scorecards: {
      overall_score: number;
      technical_score: number;
      communication_score: number;
      problem_solving_score: number;
      culture_fit_score: number;
      recommendation: string;
      ai_summary: string | null;
      behavioral_analysis?: any;
    } | null;
  } | null;
}

function getRecommendationLabel(rec: string) {
  switch (rec) {
    case 'Strong_Hire': return '✅ STRONG HIRE';
    case 'Hire': return '👍 HIRE';
    case 'Maybe': return '🤔 MAYBE';
    case 'Reject': return '❌ REJECT';
    default: return rec;
  }
}

function getRecommendationBadge(rec: string) {
  switch (rec) {
    case 'Strong_Hire': return 'badge-success';
    case 'Hire': return 'badge-success';
    case 'Maybe': return 'badge-warning';
    case 'Reject': return 'badge-danger';
    default: return 'badge-info';
  }
}

function getDuration(start: string | null, end: string | null): string {
  if (!start || !end) return 'N/A';
  const durationMs = new Date(end).getTime() - new Date(start).getTime();
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function CandidateAnalyticsPage() {
  const { id } = useParams();
  const supabase = createClient();
  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCandidate() {
      const { data, error } = await supabase
        .from('candidates')
        .select(`
          *,
          jobs(title),
          resume_screenings(*),
          interviews(*, interview_scorecards(*))
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Fetch error:', error);
      }
      setCandidate(data);
      setLoading(false);
    }
    fetchCandidate();
  }, [id, supabase]);

  if (loading) {
    return (
      <div className={styles.page} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading candidate data...
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Candidate Not Found</h1>
        <Link href="/dashboard/jobs" className="btn btn-secondary">← Back to Jobs</Link>
      </div>
    );
  }

  const interview = candidate.interviews || null;
  const scorecard = interview?.interview_scorecards || null;
  const transcript = interview?.transcript || [];
  const screening = candidate.resume_screenings;
  const fullName = `${candidate.first_name} ${candidate.last_name}`;

  const metrics = scorecard ? [
    { label: 'Technical Knowledge', score: scorecard.technical_score },
    { label: 'Communication', score: scorecard.communication_score },
    { label: 'Problem Solving', score: scorecard.problem_solving_score },
    { label: 'Culture Fit', score: scorecard.culture_fit_score },
  ] : [];

  // Build behavioral tags from screening + scorecard
  const behavioralTags: { label: string; positive: boolean }[] = [];
  if (screening) {
    screening.identified_skills?.forEach(skill => {
      behavioralTags.push({ label: skill, positive: true });
    });
    screening.missing_skills?.forEach(skill => {
      behavioralTags.push({ label: `Missing: ${skill}`, positive: false });
    });
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href={`/dashboard/jobs/${candidate.job_id}`} className={styles.backBtn}>
          <ArrowLeft size={18} />
        </Link>
        <div className={styles.headerInfo}>
          <h1 className={styles.title}>{fullName}</h1>
          <p className={styles.subtitle}>
            {candidate.jobs?.title || 'Unknown Position'} · {candidate.status}
            {interview ? ` · Interview ${interview.status}` : ''}
          </p>
        </div>
        {candidate.resume_url && (
          <a href={candidate.resume_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
            <Download size={14} /> View Resume
          </a>
        )}
      </div>

      {screening?.cv_analytics && (
        <CVAnalyticsCards data={screening.cv_analytics} />
      )}

      <div className={styles.layout}>
        {/* Left Column - Resume Screening & Transcript */}
        <div className={styles.leftCol}>
          {/* Resume Screening Results */}
          {screening && (
            <div className={styles.transcriptSection}>
              <h3 className={styles.sectionTitle}>
                <FileText size={16} /> Resume Screening
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.7 }}>
                  {screening.summary}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>AI Match Alignment</span>
                  <span className={`badge badge-${screening.match_score >= 80 ? 'success' : screening.match_score >= 60 ? 'warning' : 'danger'}`} style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
                    {screening.match_score}/100
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Interview Video / Duration */}
          {interview && (
            <div className={styles.videoPlayer}>
              <div className={styles.videoPlaceholder}>
                <div className={styles.playIcon}>🎤</div>
                <p>AI Interview Session</p>
                <span>Duration: {getDuration(interview.actual_start, interview.actual_end)}</span>
              </div>
            </div>
          )}

          {/* Transcript */}
          {transcript.length > 0 ? (
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
          ) : (
            <div className={styles.transcriptSection}>
              <h3 className={styles.sectionTitle}>
                <MessageSquare size={16} /> Interview Transcript
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: 'var(--space-md) 0' }}>
                {interview ? 'Interview was completed but no transcript was recorded.' : 'No interview conducted yet.'}
              </p>
            </div>
          )}
          {/* Professional Profile Radar Chart */}
          {screening?.cv_analytics?.professional_profile && (
             <CVRadarChart data={screening.cv_analytics} />
          )}
        </div>

        {/* Right Column - Scores & Insights */}
        <div className={styles.rightCol}>
          {/* Overall Score */}
          {scorecard ? (
            <>
              <div className={styles.scoreCard}>
                <h3 className={styles.sectionTitle}>Overall Score</h3>
                <div className={styles.scoreCenter}>
                  <ScoreCircle
                    score={scorecard.overall_score}
                    size={140}
                    label={scorecard.overall_score >= 80 ? 'Excellent' : scorecard.overall_score >= 60 ? 'Good' : scorecard.overall_score >= 40 ? 'Average' : 'Below Average'}
                  />
                </div>
              </div>

              {/* Skill Breakdown */}
              <div className={styles.metricsCard}>
                <h3 className={styles.sectionTitle}>Skill Breakdown</h3>
                <div className={styles.metricsList}>
                  {metrics.map((m) => (
                    <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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

              {/* AI Summary */}
              {scorecard.ai_summary && (
                <div className={styles.metricsCard}>
                  <h3 className={styles.sectionTitle}>AI Evaluation</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    {scorecard.ai_summary}
                  </p>
                </div>
              )}

              {/* Interview Analytics Radar Charts */}
              {scorecard?.behavioral_analysis && (
                 <InterviewRadarCharts data={scorecard.behavioral_analysis} />
              )}

              {/* Recommendation */}
              <div className={styles.recommendationCard}>
                <span className={`badge ${getRecommendationBadge(scorecard.recommendation)}`} style={{ fontSize: '0.85rem', padding: '6px 16px' }}>
                  AI Recommendation: {getRecommendationLabel(scorecard.recommendation)}
                </span>
              </div>
            </>
          ) : (
            <div className={styles.scoreCard}>
              <h3 className={styles.sectionTitle}>Interview Scores</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-lg) 0' }}>
                {interview ? 'Scoring data will appear after the interview is completed.' : 'No interview has been conducted yet.'}
              </p>
            </div>
          )}

          {/* Skills Analysis */}
          {behavioralTags.length > 0 && (
            <div className={styles.behaviorCard}>
              <h3 className={styles.sectionTitle}>
                <Eye size={16} /> Skills Analysis
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
          )}
        </div>
      </div>
    </div>
  );
}
