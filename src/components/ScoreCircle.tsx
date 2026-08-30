import styles from './ScoreCircle.module.css';

interface ScoreCircleProps {
  score: number;
  size?: number;
  label?: string;
}

export default function ScoreCircle({ score, size = 160, label }: ScoreCircleProps) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const offset = circumference - progress;

  const getTheme = () => {
    if (score >= 80) return { start: '#34d399', end: '#059669', text: '#059669', bg: '#d1fae5' };
    if (score >= 60) return { start: '#fbbf24', end: '#d97706', text: '#d97706', bg: '#fef3c7' };
    return { start: '#f43f5e', end: '#e11d48', text: '#e11d48', bg: '#ffe4e6' };
  };

  const theme = getTheme();
  const gradientId = `gradient-${score}`;

  return (
    <div className={styles.wrapper}>
      <div className={styles.circleContainer} style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.svg}>
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={theme.start} />
              <stop offset="100%" stopColor={theme.end} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={styles.progress}
          />
        </svg>
        <div className={styles.inner}>
          <div className={styles.scoreValues}>
            <span className={styles.score} style={{ color: theme.text }}>{score}</span>
            <span className={styles.total}>Out of 100</span>
          </div>
        </div>
      </div>
      {label && (
        <span className={styles.label} style={{ color: theme.text, backgroundColor: theme.bg }}>
          {label}
        </span>
      )}
    </div>
  );
}
