'use client';

import { useEffect, useState } from 'react';
import { Briefcase, Users, Video, TrendingUp, Clock, CheckCircle, UserPlus, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import StatCard from '@/components/StatCard';
import type { Job, Candidate } from '@/lib/types';
import styles from './page.module.css';

export default function DashboardPage() {
  const supabase = createClient();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [interviewsCompleted, setInterviewsCompleted] = useState(0);
  const [recentCandidates, setRecentCandidates] = useState<(Candidate & { jobs: { title: string } | null })[]>([]);
  const [pipelineData, setPipelineData] = useState<{name: string, value: number}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch jobs
        const { data: jobsData } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
        setJobs(jobsData || []);

        // Fetch candidates for stats and charts
        const { data: allCandidates, count: candidateCount } = await supabase.from('candidates').select('status', { count: 'exact' });
        setTotalCandidates(candidateCount || 0);

        if (allCandidates) {
          const stats = allCandidates.reduce((acc: any, curr) => {
            acc[curr.status] = (acc[curr.status] || 0) + 1;
            return acc;
          }, {});
          const chartData = [
            { name: 'Applied', value: stats['Applied'] || 0 },
            { name: 'AI Screening', value: stats['AI_Screening'] || 0 },
            { name: 'Shortlisted', value: stats['Shortlisted'] || 0 },
            { name: 'Interviewed', value: stats['Interviewed'] || 0 },
            { name: 'Rejected', value: stats['Rejected'] || 0 },
          ].filter(item => item.value > 0);
          setPipelineData(chartData);
        }

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

      <div className={styles.chartSection}>
        <h2 className={styles.sectionTitle}>Candidate Pipeline</h2>
        <div className={styles.chartContainer}>
          {loading ? (
             <p style={{ color: 'var(--text-muted)' }}>Loading chart...</p>
          ) : pipelineData.length === 0 ? (
             <p style={{ color: 'var(--text-muted)' }}>No candidate data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }} barSize={56}>
                <defs>
                  <linearGradient id="fillApplied" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  </linearGradient>
                  <linearGradient id="fillShortlisted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.2}/>
                  </linearGradient>
                  <linearGradient id="fillInterviewed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.2}/>
                  </linearGradient>
                  <linearGradient id="fillRejected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.2}/>
                  </linearGradient>
                  <linearGradient id="fillDefault" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-subtle)" opacity={0.6} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: 'var(--text-secondary)', fontWeight: 500 }} dy={12} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} allowDecimals={false} dx={-10} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', padding: '12px 18px' }}
                  itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                  labelStyle={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '13px' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={1000} animationEasing="ease-out">
                  {pipelineData.map((entry, index) => {
                    let fillId = 'url(#fillDefault)';
                    if (entry.name === 'Applied' || entry.name === 'AI Screening') fillId = 'url(#fillApplied)';
                    if (entry.name === 'Shortlisted') fillId = 'url(#fillShortlisted)';
                    if (entry.name === 'Interviewed') fillId = 'url(#fillInterviewed)';
                    if (entry.name === 'Rejected') fillId = 'url(#fillRejected)';
                    return <Cell key={`cell-${index}`} fill={fillId} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
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
