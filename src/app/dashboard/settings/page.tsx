'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Save, Check } from 'lucide-react';
import styles from './page.module.css';

export default function SettingsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Settings State
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [autoRejectThreshold, setAutoRejectThreshold] = useState(60);
  const [interviewDuration, setInterviewDuration] = useState(15);
  const [strictnessLevel, setStrictnessLevel] = useState('Normal');

  useEffect(() => {
    async function loadSettings() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setCompanyName(data.company_name || '');
        setWebsite(data.website || '');
        setAutoRejectThreshold(data.auto_reject_threshold || 60);
        setInterviewDuration(data.interview_duration_mins || 15);
        setStrictnessLevel(data.strictness_level || 'Normal');
      }
      setLoading(false);
    }
    loadSettings();
  }, [supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Use upsert to create or update the settings row
    const { error } = await supabase.from('company_settings').upsert({
      user_id: user.id,
      company_name: companyName,
      website,
      auto_reject_threshold: autoRejectThreshold,
      interview_duration_mins: interviewDuration,
      strictness_level: strictnessLevel,
    }, { onConflict: 'user_id' });

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Check your console logs.');
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'var(--text-muted)' }}>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your company profile and global AI interview parameters.</p>
      </div>

      <form onSubmit={handleSave}>
        {/* Company Profile Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Company Profile</h2>
            <p className={styles.sectionDesc}>This information is visible to candidates on the public application page.</p>
          </div>
          
          <div className={styles.grid2}>
            <div className="input-group">
              <label className="input-label">Company Name</label>
              <input 
                className="input" 
                placeholder="e.g. Acme Corp" 
                value={companyName} 
                onChange={(e) => setCompanyName(e.target.value)} 
              />
            </div>
            <div className="input-group">
              <label className="input-label">Company Website</label>
              <input 
                className="input" 
                placeholder="https://acme.com" 
                value={website} 
                onChange={(e) => setWebsite(e.target.value)} 
              />
            </div>
          </div>
        </div>

        {/* Global Interview Rules Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Global Interview Rules</h2>
            <p className={styles.sectionDesc}>Set the default behaviors and thresholds for your automated hiring pipeline.</p>
          </div>

          <div className="input-group">
            <label className="input-label">Resume Auto-Reject Threshold (0-100)</label>
            <p className={styles.sectionDesc} style={{ marginBottom: '8px' }}>
              Candidates who score below this threshold during the AI text screening will be automatically rejected.
            </p>
            <input 
              type="number" 
              className="input" 
              min="0" 
              max="100" 
              value={autoRejectThreshold} 
              onChange={(e) => setAutoRejectThreshold(parseInt(e.target.value) || 0)} 
            />
          </div>

          <div className={styles.grid2}>
            <div className="input-group">
              <label className="input-label">Default Interview Duration (Minutes)</label>
              <input 
                type="number" 
                className="input" 
                min="5" 
                max="60" 
                value={interviewDuration} 
                onChange={(e) => setInterviewDuration(parseInt(e.target.value) || 15)} 
              />
            </div>
            
            <div className="input-group">
              <label className="input-label">AI Grading Strictness</label>
              <select 
                className="input" 
                value={strictnessLevel} 
                onChange={(e) => setStrictnessLevel(e.target.value)}
              >
                <option value="Lenient">Lenient</option>
                <option value="Normal">Normal</option>
                <option value="Strict">Strict</option>
              </select>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? 'Saving...' : (saved ? <><Check size={18} /> Saved successfully</> : <><Save size={18} /> Save Settings</>)}
          </button>
        </div>
      </form>
    </div>
  );
}
