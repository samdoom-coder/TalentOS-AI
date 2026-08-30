import styles from './ScoreCircle.module.css';

interface ScoreCircleProps {
  score: number;
  size?: number;
  label?: string;
}

export default function ScoreCircle({ score, size = 120, label }: ScoreCircleProps) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const offset = circumference - progress;

  const getColor = () => {
    if (score >= 80) return 'var(--color-success)';
    if (score >= 60) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  return (
    <div className={styles.wrapper}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.svg}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth="8"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={styles.progress}
        />
      </svg>
      <div className={styles.inner}>
        <span className={styles.score} style={{ color: getColor() }}>{score}</span>
        <span className={styles.total}>/100</span>
      </div>
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
}
