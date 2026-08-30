'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Copy, Check, Loader2, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import CandidateCard from '@/components/CandidateCard';
import type { Job, CandidateWithScreening } from '@/lib/types';
import styles from './page.module.css';

const columns = ['Applied', 'Shortlisted', 'Invited', 'Interviewed', 'Rejected'];

const statusMap: Record<string, string> = {
  'Applied': 'Applied',
  'AI_Screening': 'Applied',
  'Shortlisted': 'Shortlisted',
  'Invited': 'Invited',
  'Interviewed': 'Interviewed',
  'Rejected': 'Rejected',
};

interface InviteResult {
  email: string;
  success: boolean;
  link?: string;
  emailSent?: boolean;
}

export default function JobPipelinePage() {
  const { id } = useParams();
  const supabase = createClient();
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<(CandidateWithScreening & { interviews?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteResults, setInviteResults] = useState<InviteResult[] | null>(null);

  const fetchData = async () => {
    const { data: jobData } = await supabase.from('jobs').select('*').eq('id', id).single();
    setJob(jobData);

    const { data: candidatesData } = await supabase
      .from('candidates')
      .select('*, resume_screenings(*), interviews(*, interview_scorecards(*))')
      .eq('job_id', id)
      .order('created_at', { ascending: false });
    setCandidates(candidatesData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [id, supabase]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/apply/${id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInviteShortlisted = async () => {
    setInviting(true);
    setInviteResults(null);
    try {
      const res = await fetch('/api/interview/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: id }),
      });
      const data = await res.json();
      if (data.results) {
        setInviteResults(data.results);
      }
      // Refresh candidate list to show updated statuses
      await fetchData();
    } catch (err) {
      console.error('Invite error:', err);
      alert('Failed to send invitations');
    } finally {
      setInviting(false);
    }
  };

  const getCandidatesForColumn = (column: string) => {
    return candidates.filter(c => {
      const mapped = statusMap[c.status] || c.status;
      return mapped === column;
    });
  };

  const shortlistedCount = getCandidatesForColumn('Shortlisted').length;

  if (loading) return <div className={styles.page} style={{ color: 'var(--text-muted)' }}>Loading pipeline...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/dashboard/jobs" className={styles.backBtn}><ArrowLeft size={18} /></Link>
          <div>
            <h1 className={styles.title}>{job?.title || 'Job'}</h1>
            <p className={styles.subtitle}>Pipeline View · {candidates.length} candidates</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-secondary btn-sm" onClick={copyLink}>
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Apply Link</>}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleInviteShortlisted}
            disabled={inviting || shortlistedCount === 0}
          >
            {inviting ? (
              <><Loader2 size={14} className={styles.spinning} /> Inviting...</>
            ) : (
              <><Send size={14} /> Invite Shortlisted ({shortlistedCount})</>
            )}
          </button>
        </div>
      </div>

      {/* Invite Results Banner */}
      {inviteResults && inviteResults.length > 0 && (
        <div className={styles.inviteBanner}>
          <strong>✅ {inviteResults.filter(r => r.success).length} candidate(s) invited!</strong>
          {inviteResults.some(r => r.link && !r.emailSent) && (
            <div className={styles.inviteLinks}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Interview links (email not configured):</span>
              {inviteResults.filter(r => r.link).map((r, i) => (
                <div key={i} className={styles.inviteLinkRow}>
                  <span>{r.email}</span>
                  <a href={r.link} target="_blank" rel="noopener noreferrer" className={styles.inviteLink}>
                    <ExternalLink size={12} /> Open
                  </a>
                  <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(r.link || ''); }}>
                    <Copy size={12} /> Copy
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={styles.kanban}>
        {columns.map((col) => {
          const colCandidates = getCandidatesForColumn(col);
          return (
            <div key={col} className={styles.column}>
              <div className={styles.columnHeader}>
                <span className={styles.columnTitle}>{col}</span>
                <span className={styles.columnCount}>{colCandidates.length}</span>
              </div>
              <div className={styles.columnBody}>
                {colCandidates.length === 0 ? (
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>No candidates</p>
                ) : (
                  colCandidates.map((candidate) => (
                    <Link key={candidate.id} href={`/dashboard/candidates/${candidate.id}`} style={{ textDecoration: 'none' }}>
                      <CandidateCard
                        name={`${candidate.first_name} ${candidate.last_name}`}
                        email={candidate.email}
                        score={
                          (() => {
                            const int = Array.isArray(candidate.interviews) ? candidate.interviews[0] : candidate.interviews;
                            const sc = Array.isArray(int?.interview_scorecards) ? int.interview_scorecards[0] : int?.interview_scorecards;
                            if (sc?.overall_score) return sc.overall_score;
                            
                            const scr = Array.isArray(candidate.resume_screenings) ? candidate.resume_screenings[0] : candidate.resume_screenings;
                            return scr?.match_score;
                          })()
                        }
                        status={candidate.status}
                        appliedDate={new Date(candidate.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

