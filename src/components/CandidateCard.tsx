import styles from './CandidateCard.module.css';

interface CandidateCardProps {
  name: string;
  email: string;
  score?: number;
  status: string;
  appliedDate: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'danger';
}

export default function CandidateCard({ name, email, score, status, appliedDate }: CandidateCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.avatar}>{name.charAt(0).toUpperCase()}</div>
        <div className={styles.info}>
          <span className={styles.name}>{name}</span>
          <span className={styles.email}>{email}</span>
        </div>
      </div>
      {score !== undefined && (
        <div className={styles.scoreRow}>
          <span className={styles.scoreLabel}>AI Score</span>
          <span className={`badge badge-${getScoreColor(score)}`}>{score}/100</span>
        </div>
      )}
      <div className={styles.footer}>
        <span className={styles.date}>{appliedDate}</span>
        <span className={`badge badge-info`}>{status}</span>
      </div>
    </div>
  );
}
