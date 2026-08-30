'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Users, Calendar, Copy, Check, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Job, AiPersona } from '@/lib/types';
import styles from './page.module.css';

export default function JobsPage() {
  const supabase = createClient();
  const [jobs, setJobs] = useState<(Job & { candidates: { count: number }[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newPersonaId, setNewPersonaId] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [personas, setPersonas] = useState<AiPersona[]>([]);

  const fetchData = async () => {
    const { data: jobsData } = await supabase
      .from('jobs')
      .select('*, candidates(count)')
      .order('created_at', { ascending: false });
    setJobs(jobsData || []);

    const { data: personasData } = await supabase
      .from('ai_personas')
      .select('*')
      .order('created_at', { ascending: false });
    setPersonas(personasData || []);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('jobs').insert({
      user_id: user.id,
      title: newTitle,
      description: newDesc,
      location: newLocation,
      ai_persona_id: newPersonaId || null,
      status: 'Active',
    });

    setNewTitle('');
    setNewDesc('');
    setNewLocation('');
    setNewPersonaId('');
    setShowCreate(false);
    setCreating(false);
    fetchData();
  };

  const copyLink = (jobId: string) => {
    const url = `${window.location.origin}/apply/${jobId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(jobId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = jobs.filter(j => j.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Jobs</h1>
          <p className={styles.subtitle}>Manage your open positions and track candidates.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={18} /> Create New Job
        </button>
      </div>

      {/* Create Job Modal */}
      {showCreate && (
        <div className={styles.modal} onClick={() => setShowCreate(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Create New Job</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateJob}>
              <div className="input-group">
                <label className="input-label">Job Title *</label>
                <input className="input" placeholder="e.g. Senior React Developer" value={newTitle} onChange={e => setNewTitle(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">Location</label>
                <input className="input" placeholder="e.g. Remote · India" value={newLocation} onChange={e => setNewLocation(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Job Description</label>
                <textarea className={`input ${styles.textarea}`} placeholder="Describe the role, responsibilities, and ideal candidate..." value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={5} />
              </div>
              <div className="input-group">
                <label className="input-label">AI Interviewer Persona (Optional)</label>
                <select className="input" value={newPersonaId} onChange={e => setNewPersonaId(e.target.value)}>
                  <option value="">Default AI Interviewer</option>
                  {personas.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.role ? `- ${p.role}` : ''}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={creating}>
                {creating ? 'Creating...' : 'Create Job'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className={styles.searchBar}>
        <Search size={16} className={styles.searchIcon} />
        <input type="text" className={`input ${styles.searchInput}`} placeholder="Search jobs by title..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span className={styles.colTitle}>Job Title</span>
          <span className={styles.colStatus}>Status</span>
          <span className={styles.colCandidates}>Candidates</span>
          <span className={styles.colInterviews}>Apply Link</span>
          <span className={styles.colDate}>Created</span>
        </div>
        {loading ? (
          <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading jobs...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No jobs found. Create one to get started!</div>
        ) : (
          filtered.map((job) => (
            <div key={job.id} className={styles.tableRow}>
              <Link href={`/dashboard/jobs/${job.id}`} className={styles.colTitle}>
                <strong>{job.title}</strong>
              </Link>
              <span className={styles.colStatus}>
                <span className={`badge ${job.status === 'Active' ? 'badge-success' : job.status === 'Closed' ? 'badge-danger' : 'badge-warning'}`}>
                  {job.status}
                </span>
              </span>
              <span className={styles.colCandidates}>
                <Users size={14} /> {job.candidates?.[0]?.count || 0}
              </span>
              <span className={styles.colInterviews}>
                <button className="btn btn-ghost btn-sm" onClick={() => copyLink(job.id)}>
                  {copiedId === job.id ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Link</>}
                </button>
              </span>
              <span className={styles.colDate}>
                <Calendar size={14} /> {new Date(job.created_at).toLocaleDateString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
