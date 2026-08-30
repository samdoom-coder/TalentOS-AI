import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import styles from './CVRadarChart.module.css';
import type { CVAnalytics } from '@/lib/types';

interface Props {
  data: CVAnalytics;
}

const formatLabel = (key: string) => {
  return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function CVRadarChart({ data }: Props) {
  const profile = data.professional_profile;

  const getScore = (val: any) => typeof val === 'number' ? val : (val?.score || 0);

  // Formatting data for Recharts
  const chartData = profile ? [
    { subject: 'Strategic Focus', score: getScore(profile.strategic_focus) },
    { subject: 'Learning Velocity', score: getScore(profile.learning_velocity) },
    { subject: 'Career Progression', score: getScore(profile.career_progression) },
    { subject: 'Drive & Initiative', score: getScore(profile.drive_and_initiative) },
    { subject: 'Intellectual Ability', score: getScore(profile.intellectual_ability) },
    { subject: 'Managerial Experience', score: getScore(profile.managerial_experience) },
    { subject: 'Recognized Accomplishments', score: getScore(profile.recognized_accomplishments) },
    { subject: 'Original & Creative Thinking', score: getScore(profile.original_and_creative_thinking) }
  ] : [];

  if (chartData.length === 0) return null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.customTooltip}>
          <p className={styles.tooltipLabel}>{payload[0].payload.subject}</p>
          <p className={styles.tooltipScore}>Score: <span className={styles.tooltipHighlight}>{payload[0].value}</span> / 5</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Professional Profile Analysis</h3>
        <p className={styles.subtitle}>Based solely on <strong>CV</strong></p>
      </div>

      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={350}>
          <RadarChart cx="50%" cy="50%" outerRadius="60%" data={chartData} margin={{ top: 20, right: 60, bottom: 20, left: 60 }}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={({ payload, x, y, textAnchor }: any) => {
                const parts = payload.value.split(' ');
                const half = parts.length > 2 ? Math.ceil(parts.length / 2) : 1;
                const line1 = parts.length > 1 ? parts.slice(0, half).join(' ') : payload.value;
                const line2 = parts.length > 1 ? parts.slice(half).join(' ') : '';
                return (
                  <text x={x} y={y} textAnchor={textAnchor} fill="#4b5563" fontSize={10} fontWeight={500}>
                    <tspan x={x} dy={line2 ? "-0.4em" : "0.3em"}>{line1}</tspan>
                    {line2 && <tspan x={x} dy="1.2em">{line2}</tspan>}
                  </text>
                );
              }}
            />
            <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Radar
              name="Profile"
              dataKey="score"
              stroke="#6366f1"
              strokeWidth={2}
              fill="#6366f1"
              fillOpacity={0.2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
