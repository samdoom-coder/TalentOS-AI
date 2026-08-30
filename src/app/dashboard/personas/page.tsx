'use client';

import { useEffect, useState } from 'react';
import { Plus, Volume2, Bot, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { AiPersona } from '@/lib/types';
import styles from './page.module.css';

export default function PersonasPage() {
  const supabase = createClient();
  const [personas, setPersonas] = useState<AiPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setRole('');
    setDescription('');
    setSystemPrompt('');
    setColor('#6366f1');
    setShowCreate(false);
  };

  const fetchPersonas = async () => {
    const { data } = await supabase.from('ai_personas').select('*').order('created_at', { ascending: false });
    setPersonas(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPersonas();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingId) {
      await supabase.from('ai_personas').update({
        name,
        role,
        description,
        system_prompt: systemPrompt,
        color,
      }).eq('id', editingId);
    } else {
      await supabase.from('ai_personas').insert({
        user_id: user.id,
        name,
        role,
        description,
        system_prompt: systemPrompt,
        color,
      });
    }

    resetForm();
    setCreating(false);
    fetchPersonas();
  };

  const handleEditClick = (persona: AiPersona) => {
    setEditingId(persona.id);
    setName(persona.name);
    setRole(persona.role);
    setDescription(persona.description || '');
    setSystemPrompt(persona.system_prompt || '');
    setColor(persona.color || '#6366f1');
    setShowCreate(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this persona?')) {
      await supabase.from('ai_personas').delete().eq('id', id);
      fetchPersonas();
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>AI Personas</h1>
          <p className={styles.subtitle}>Configure AI interviewers with unique personalities.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowCreate(true); }}>
          <Plus size={18} /> Create New Persona
        </button>
      </div>

      {/* Create / Edit Modal */}
      {showCreate && (
        <div className={styles.modal} onClick={resetForm}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingId ? 'Edit AI Persona' : 'Create AI Persona'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={resetForm}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label className="input-label">Persona Name *</label>
                <input className="input" placeholder="e.g. Sarah Chen" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">Role *</label>
                <input className="input" placeholder="e.g. Technical Lead" value={role} onChange={e => setRole(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">Description</label>
                <textarea className={`input ${styles.textarea}`} placeholder="Describe the persona's interviewing style..." value={description} onChange={e => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="input-group">
                <label className="input-label">System Prompt</label>
                <textarea className={`input ${styles.textarea}`} placeholder="You are a strict technical interviewer..." value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={4} />
              </div>
              <div className="input-group">
                <label className="input-label">Accent Color</label>
                <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: '60px', height: '36px', cursor: 'pointer' }} />
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={creating}>
                {creating ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Persona')}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className={styles.grid}>
        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading personas...</p>
        ) : personas.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No personas yet. Create your first AI interviewer!</p>
        ) : (
          personas.map((persona) => (
            <div key={persona.id} className={styles.personaCard}>
              <div className={styles.avatarLarge} style={{ background: `linear-gradient(135deg, ${persona.color}, ${persona.color}88)` }}>
                <Bot size={32} />
              </div>
              <div className={styles.personaInfo}>
                <h3 className={styles.personaName}>{persona.name}</h3>
                <span className={styles.personaRole}>{persona.role}</span>
                <p className={styles.personaDesc}>{persona.description || 'No description'}</p>
                {persona.voice_id && (
                  <div className={styles.voiceRow}><Volume2 size={14} /><span>{persona.voice_id}</span></div>
                )}
              </div>
              <div className={styles.cardActions}>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(persona.id)}>Delete</button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleEditClick(persona)}>Edit</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
