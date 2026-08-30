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
import styles from './InterviewRadarCharts.module.css';

interface Props {
  data: any; // `behavioral_analysis` object
}

interface TickProps {
  payload: any;
  x: number;
  y: number;
  textAnchor: string;
  data: any[];
}

const CustomTick = ({ payload, x, y, textAnchor, data }: TickProps) => {
  const item = data.find((d) => d.subject === payload.value);
  const score = item ? item.score : 0;
  
  let scoreColor = '#16a34a'; // green
  if (score < 3) scoreColor = '#dc2626'; // red
  else if (score < 4) scoreColor = '#ca8a04'; // yellow

  // Provide some offset logic so foreignObject doesn't get clipped.
  let xOffset = 0;
  let flexAlign = 'center';

  // Reduce offsets and constraints so long labels wrap!
  if (textAnchor === 'start') {
    xOffset = 10;
    flexAlign = 'flex-start';
  } else if (textAnchor === 'end') {
    xOffset = -120;
    flexAlign = 'flex-end';
  } else {
    xOffset = -55;
  }

  // Push top/bottom labels slightly away from center
  const yOffset = y < 150 ? -20 : (y > 200 ? -5 : -14);

  // Allow foreignObject ample height for wrapping
  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x={xOffset} y={yOffset} width={110} height={70} style={{ overflow: 'visible' }}>
        <div className={styles.tickContainer} style={{ justifyContent: flexAlign }}>
          <div className={styles.tickLabel}>
            <span className={styles.tickSubject}>{payload.value}</span>
            <span className={styles.tickScore} style={{ color: scoreColor }}>{score}/5</span>
          </div>
        </div>
      </foreignObject>
    </g>
  );
};

export default function InterviewRadarCharts({ data }: Props) {
  if (!data) return null;
  const comm = data.communication_skills;
  const cog = data.cognitive_insights;

  const getScore = (val: any) => typeof val === 'number' ? val : 0;

  const commData = comm ? [
    { subject: 'Grammar', score: getScore(comm.grammar) },
    { subject: 'Comprehension', score: getScore(comm.comprehension) },
    { subject: 'Fluency', score: getScore(comm.fluency) },
    { subject: 'Vocabulary Sufficiency', score: getScore(comm.vocabulary_sufficiency) },
    { subject: 'Coherence', score: getScore(comm.coherence) }
  ] : [];

  const cogData = cog ? [
    { subject: 'Logical Reasoning', score: getScore(cog.logical_reasoning) },
    { subject: 'Critical Thinking', score: getScore(cog.critical_thinking) },
    { subject: 'Problem Solving', score: getScore(cog.problem_solving) },
    { subject: 'Big-picture thinking', score: getScore(cog.big_picture_thinking) },
    { subject: 'Insightfulness', score: getScore(cog.insightfulness) },
    { subject: 'Clarity', score: getScore(cog.clarity) },
    { subject: 'Decision Making', score: getScore(cog.decision_making) },
    { subject: 'Intellectual Self-Awareness', score: getScore(cog.intellectual_self_awareness) }
  ] : [];

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

  if (commData.length === 0 && cogData.length === 0) return null;

  return (
    <div className={styles.container}>
      {commData.length > 0 && (
        <div className={styles.chartCard}>
          <div className={styles.header}>
            <h3 className={styles.title}>Communication Skills</h3>
            <p className={styles.subtitle}>Based solely on <strong>Interview</strong></p>
          </div>
          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart cx="50%" cy="50%" outerRadius="60%" data={commData} margin={{ top: 20, right: 60, bottom: 20, left: 60 }}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis 
                  dataKey="subject" 
                  tick={(props: any) => <CustomTick {...props} data={commData} />} 
                />
                <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Radar
                  name="Communication"
                  dataKey="score"
                  stroke="#475569"
                  strokeWidth={2}
                  fill="#64748b"
                  fillOpacity={0.8}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {cogData.length > 0 && (
        <div className={styles.chartCard}>
          <div className={styles.header}>
            <h3 className={styles.title}>Cognitive Insights</h3>
            <p className={styles.subtitle}>Based solely on <strong>Interview</strong></p>
          </div>
          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart cx="50%" cy="50%" outerRadius="60%" data={cogData} margin={{ top: 20, right: 60, bottom: 20, left: 60 }}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis 
                  dataKey="subject" 
                  tick={(props: any) => <CustomTick {...props} data={cogData} />} 
                />
                <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Radar
                  name="Cognitive"
                  dataKey="score"
                  stroke="#475569"
                  strokeWidth={2}
                  fill="#64748b"
                  fillOpacity={0.8}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
