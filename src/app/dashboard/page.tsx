'use client';

import { useEffect, useState } from 'react';
import { Briefcase, Users, Video, TrendingUp, Clock, CheckCircle, UserPlus, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import StatCard from '@/components/StatCard';
import type { Job, Candidate } from '@/lib/types';
import styles from './page.module.css';

export default function DashboardPage() {
  const supabase = createClient();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [interviewsCompleted, setInterviewsCompleted] = useState(0);
  const [recentCandidates, setRecentCandidates] = useState<(Candidate & { jobs: { title: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch jobs
        const { data: jobsData } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
        setJobs(jobsData || []);

        // Fetch total candidates count
        const { count: candidateCount } = await supabase.from('candidates').select('*', { count: 'exact', head: true });
        setTotalCandidates(candidateCount || 0);

        // Fetch completed interviews count
        const { count: interviewCount } = await supabase.from('interviews').select('*', { count: 'exact', head: true }).eq('status', 'Completed');
        setInterviewsCompleted(interviewCount || 0);

        // Fetch recent candidates with job title
        const { data: recentData } = await supabase
          .from('candidates')
          .select('*, jobs(title)')
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentCandidates(recentData || []);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [supabase]);

  const activeJobs = jobs.filter(j => j.status === 'Active').length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Welcome back! Here&apos;s your recruitment overview.</p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <StatCard icon={Briefcase} label="Active Jobs" value={loading ? '...' : activeJobs} color="primary" />
        <StatCard icon={Users} label="Total Candidates" value={loading ? '...' : totalCandidates} color="info" />
        <StatCard icon={Video} label="Interviews Completed" value={loading ? '...' : interviewsCompleted} color="success" />
        <StatCard icon={TrendingUp} label="Total Jobs" value={loading ? '...' : jobs.length} color="warning" />
      </div>

      <div className={styles.sections}>
        <div className={styles.activitySection}>
          <h2 className={styles.sectionTitle}>Recent Candidates</h2>
          <div className={styles.activityList}>
            {loading ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading...</p>
            ) : recentCandidates.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No candidates yet. Create a job and share the link!</p>
            ) : (
              recentCandidates.map((candidate) => (
                <div key={candidate.id} className={styles.activityItem}>
                  <div className={`${styles.activityIcon} ${styles.info}`}>
                    <UserPlus size={16} />
                  </div>
                  <div className={styles.activityContent}>
                    <span className={styles.activityText}>
                      {candidate.first_name} {candidate.last_name} applied for {candidate.jobs?.title || 'a position'}
                    </span>
                    <span className={styles.activityTime}>
                      <Clock size={12} /> {new Date(candidate.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span className={`badge badge-${candidate.status === 'Shortlisted' ? 'success' : candidate.status === 'Rejected' ? 'danger' : 'info'}`}>
                    {candidate.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.quickActions}>
          <h2 className={styles.sectionTitle}>Quick Actions</h2>
          <div className={styles.actionGrid}>
            <a href="/dashboard/jobs" className={styles.actionCard}>
              <Plus size={24} />
              <span>Create New Job</span>
            </a>
            <a href="/dashboard/personas" className={styles.actionCard}>
              <CheckCircle size={24} />
              <span>Manage AI Personas</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
