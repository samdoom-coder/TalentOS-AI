'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Copy, Check } from 'lucide-react';
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

export default function JobPipelinePage() {
  const { id } = useParams();
  const supabase = createClient();
  const [job, setJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<CandidateWithScreening[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data: jobData } = await supabase.from('jobs').select('*').eq('id', id).single();
      setJob(jobData);

      const { data: candidatesData } = await supabase
        .from('candidates')
        .select('*, resume_screenings(*)')
        .eq('job_id', id)
        .order('created_at', { ascending: false });
      setCandidates(candidatesData || []);
      setLoading(false);
    }
    fetchData();
  }, [id, supabase]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/apply/${id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCandidatesForColumn = (column: string) => {
    return candidates.filter(c => {
      const mapped = statusMap[c.status] || c.status;
      return mapped === column;
    });
  };

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
          <button className="btn btn-primary btn-sm">
            <Send size={14} /> Invite Shortlisted
          </button>
        </div>
      </div>

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
                        score={candidate.resume_screenings?.match_score}
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
