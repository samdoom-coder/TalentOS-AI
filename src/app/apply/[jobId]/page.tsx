'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Upload, CheckCircle, Briefcase, MapPin, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Job } from '@/lib/types';
import styles from './page.module.css';

export default function ApplyPage() {
  const { jobId } = useParams();
  const supabase = createClient();
  const [job, setJob] = useState<Job | null>(null);
  const [companyName, setCompanyName] = useState('HireAI');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [fileName, setFileName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchJob() {
      const { data } = await supabase.from('jobs').select('*').eq('id', jobId).eq('status', 'Active').single();
      setJob(data);

      if (data?.user_id) {
        const { data: companyData } = await supabase
          .from('company_settings')
          .select('company_name')
          .eq('user_id', data.user_id)
          .single();
        
        if (companyData?.company_name) {
          setCompanyName(companyData.company_name);
        }
      }

      setLoading(false);
    }
    fetchJob();
  }, [jobId, supabase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setFileName(e.target.files[0].name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      let resumeUrl = null;

      // Upload resume via server API (uses service role key to bypass storage RLS)
      if (file) {
        const uploadForm = new FormData();
        uploadForm.append('jobId', jobId as string);
        uploadForm.append('resume', file);
        try {
          const uploadRes = await fetch('/api/apply', { method: 'POST', body: uploadForm });
          const uploadData = await uploadRes.json();
          resumeUrl = uploadData.resumeUrl || null;
          if (!resumeUrl) console.warn('Resume upload returned no URL:', uploadData);
        } catch (uploadErr) {
          console.error('Resume upload error:', uploadErr);
        }
      }

      // Insert candidate
      const { data: insertedCandidate, error: insertError } = await supabase.from('candidates').insert({
        job_id: jobId,
        first_name: firstName,
        last_name: lastName,
        email: email,
        linkedin_url: linkedin || null,
        resume_url: resumeUrl,
        status: 'Applied',
      }).select('id').single();

      if (insertError) throw insertError;

      // Trigger AI resume screening and await result
      if (insertedCandidate?.id) {
        const screenRes = await fetch('/api/interview/screen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidateId: insertedCandidate.id, jobId }),
        });

        if (!screenRes.ok) {
          // If AI screening fails, log the error but don't block the candidate from being saved
          console.warn('AI screening failed (non-blocking):', await screenRes.text());
        } else {
          const screenData = await screenRes.json();
          if (screenData.screening?.status === 'Shortlisted') {
            // Generate the interview link by triggering the invite endpoint
            const inviteRes = await fetch('/api/interview/invite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jobId }),
            });
            
            if (inviteRes.ok) {
              const inviteData = await inviteRes.json();
              // Find the invite link for this specific candidate
              const myInvite = inviteData.results?.find((r: any) => r.email === email);
              if (myInvite && myInvite.link) {
                window.location.href = myInvite.link;
                return; // Stop execution to let the redirect happen
              }
            }
          }
        }
      }

      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <p style={{ color: 'var(--text-muted)' }}>Loading job details...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className={styles.container}>
        <div className={styles.successCard}>
          <h1 className={styles.successTitle}>Job Not Found</h1>
          <p className={styles.successText}>This job posting may have been closed or the link is incorrect.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={styles.container}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}><CheckCircle size={48} /></div>
          <h1 className={styles.successTitle}>Application Submitted!</h1>
          <p className={styles.successText}>
            Thank you for applying to <strong>{job.title}</strong>. Your resume is being reviewed by our AI screening system.
            You will receive an email with next steps within 24-48 hours.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.mainCard}>
        <div className={styles.jobHeader}>
          <div className={styles.companyLogo}>{companyName.charAt(0).toUpperCase()}</div>
          <div>
            <h1 className={styles.jobTitle}>{job.title}</h1>
            <p className={styles.companyName}>{companyName}</p>
          </div>
        </div>

        <div className={styles.jobMeta}>
          {job.location && <span className={styles.metaItem}><MapPin size={14} /> {job.location}</span>}
          <span className={styles.metaItem}><Clock size={14} /> {job.job_type}</span>
          <span className={styles.metaItem}><Briefcase size={14} /> Open Position</span>
        </div>

        {job.description && (
          <div className={styles.jobDescription}>
            <h2 className={styles.sectionLabel}>About This Role</h2>
            <p>{job.description}</p>
          </div>
        )}

        <div className={styles.divider} />

        <h2 className={styles.formTitle}>Apply for this position</h2>

        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label className="input-label">First Name *</label>
              <input className="input" placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} required />
            </div>
            <div className="input-group">
              <label className="input-label">Last Name *</label>
              <input className="input" placeholder="Last name" value={lastName} onChange={e => setLastName(e.target.value)} required />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Email Address *</label>
            <input type="email" className="input" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="input-group">
            <label className="input-label">LinkedIn URL (Optional)</label>
            <input type="url" className="input" placeholder="https://linkedin.com/in/..." value={linkedin} onChange={e => setLinkedin(e.target.value)} />
          </div>

          <div className="input-group">
            <label className="input-label">Resume / CV *</label>
            <label className={styles.dropzone}>
              <input type="file" accept=".pdf" className={styles.fileInput} onChange={handleFileChange} required />
              {fileName ? (
                <div className={styles.dropzoneContent}>
                  <CheckCircle size={24} className={styles.dropzoneIconSuccess} />
                  <span className={styles.dropzoneFileName}>{fileName}</span>
                  <span className={styles.dropzoneHint}>Click to change file</span>
                </div>
              ) : (
                <div className={styles.dropzoneContent}>
                  <Upload size={28} className={styles.dropzoneIcon} />
                  <span className={styles.dropzoneText}>Drop your resume here or click to browse</span>
                  <span className={styles.dropzoneHint}>PDF only · Max 10MB</span>
                </div>
              )}
            </label>
          </div>

          <button type="submit" className={`btn btn-primary btn-lg ${styles.submitBtn}`} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </div>

      <p className={styles.poweredBy}>Powered by <strong>{companyName}</strong></p>
    </div>
  );
}
