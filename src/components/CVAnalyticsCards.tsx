'use client';

import React, { useState } from 'react';
import { Flag, CheckCircle, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import styles from './CVAnalyticsCards.module.css';
import type { CVAnalytics } from '@/lib/types';

interface Props {
  data: CVAnalytics;
}

const getScore = (val: any) => typeof val === 'number' ? val : (val?.score || 0);
const getReasoning = (val: any) => typeof val === 'object' && val?.reasoning ? val.reasoning : '';
const getFlag = (val: any) => typeof val === 'boolean' ? val : (val?.flagged || false);
const getValueString = (val: any) => typeof val === 'string' ? val : (val?.value || 'Unknown');

const docScoreColor = (score: number) => score >= 4 ? styles.scoreHigh : score >= 3 ? styles.scoreMedium : styles.scoreLow;
const flagColor = (flagged: boolean) => flagged ? styles.flagBad : styles.flagGood;

function AccordionRow({ icon, label, badge, reasoning }: { icon?: React.ReactNode, label: string, badge: React.ReactNode, reasoning?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => { if (reasoning) setIsOpen(!isOpen); };

  return (
    <div className={`${styles.rowContainer} ${isOpen ? styles.rowOpen : ''}`}>
      <div className={styles.row} onClick={toggle} style={{ cursor: reasoning ? 'pointer' : 'default' }}>
        <div className={styles.rowLabel}>
          {icon && icon} <span>{label}</span>
        </div>
        <div className={styles.rowRight}>
          {badge}
          {reasoning && (
            <div className={styles.chevron}>
              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          )}
        </div>
      </div>
      {isOpen && reasoning && (
        <div className={styles.rowReasoning}>
          <p>{reasoning}</p>
        </div>
      )}
    </div>
  );
}

export default function CVAnalyticsCards({ data }: Props) {
  const docScoreBadge = (score: number) => (
    <div className={`${styles.scoreBadge} ${docScoreColor(score)}`}>{score} / 5</div>
  );

  const flagBadge = (flagged: boolean) => (
    <div className={`${styles.flagBadge} ${flagColor(flagged)}`}>
      {flagged ? <Flag size={14} /> : <Flag size={14} />}
    </div>
  );

  const tagBadge = (val: string) => (
    <div className={styles.tagBadge}>{val}</div>
  );

  const p = data.document_professionalism;
  const rf = data.cv_red_flags;
  const ka = data.key_attributes;

  return (
    <div className={styles.grid}>
      {/* 1. Document Professionalism */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Document Professionalism</h3>
          <p className={styles.cardSubtitle}>Based solely on <strong>CV</strong></p>
        </div>
        <div className={styles.rowList}>
          <AccordionRow 
            icon={<CheckCircle size={16} />} 
            label="Attention to Detail" 
            badge={docScoreBadge(getScore(p?.attention_to_detail))} 
            reasoning={getReasoning(p?.attention_to_detail)} 
          />
          <AccordionRow 
            icon={<Activity size={16} />} 
            label="Clarity and Completeness" 
            badge={docScoreBadge(getScore(p?.clarity_and_completeness))} 
            reasoning={getReasoning(p?.clarity_and_completeness)} 
          />
        </div>
      </div>

      {/* 2. CV Red Flag Analysis */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>CV Red Flag Analysis</h3>
          <p className={styles.cardSubtitle}>Based solely on <strong>CV</strong></p>
        </div>
        <div className={styles.rowList}>
          <AccordionRow 
            label="Timeline and Tenure" 
            badge={flagBadge(getFlag(rf?.timeline_and_tenure))} 
            reasoning={getReasoning(rf?.timeline_and_tenure) || (!getFlag(rf?.timeline_and_tenure) ? 'No red flag found' : '')} 
          />
          <AccordionRow 
            label="Experience and Representation" 
            badge={flagBadge(getFlag(rf?.experience_and_representation))} 
            reasoning={getReasoning(rf?.experience_and_representation) || (!getFlag(rf?.experience_and_representation) ? 'No red flag found' : '')} 
          />
          <AccordionRow 
            label="Other Red Flags" 
            badge={flagBadge(getFlag(rf?.other_red_flags))} 
            reasoning={getReasoning(rf?.other_red_flags) || (!getFlag(rf?.other_red_flags) ? 'No red flag found' : '')} 
          />
        </div>
      </div>

      {/* 3. Key Attributes & Potential */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Key Attributes & Potential</h3>
          <p className={styles.cardSubtitle}>Based solely on <strong>CV</strong></p>
        </div>
        <div className={styles.rowList}>
          <AccordionRow 
            label="Experience Model" 
            badge={tagBadge(getValueString(ka?.experience_model))} 
            reasoning={getReasoning(ka?.experience_model)} 
          />
          <AccordionRow 
            label="Leadership Potential" 
            badge={docScoreBadge(getScore(ka?.leadership_potential))} 
            reasoning={getReasoning(ka?.leadership_potential)} 
          />
          <AccordionRow 
            label="Entrepreneurial Spirit" 
            badge={docScoreBadge(getScore(ka?.entrepreneurial_spirit))} 
            reasoning={getReasoning(ka?.entrepreneurial_spirit)} 
          />
          <AccordionRow 
            label="Estimated Career Potential" 
            badge={docScoreBadge(getScore(ka?.estimated_career_potential))} 
            reasoning={getReasoning(ka?.estimated_career_potential)} 
          />
        </div>
      </div>
    </div>
  );
}
