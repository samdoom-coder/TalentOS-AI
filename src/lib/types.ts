export interface AiPersona {
  id: string;
  user_id: string;
  name: string;
  role: string;
  description: string | null;
  voice_id: string | null;
  avatar_url: string | null;
  system_prompt: string | null;
  color: string;
  created_at: string;
}

export interface Job {
  id: string;
  user_id: string;
  ai_persona_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  job_type: string;
  required_skills: string[];
  scoring_rubric: Record<string, unknown>;
  status: 'Active' | 'Closed' | 'Draft';
  created_at: string;
}

export type CandidateStatus = 'Applied' | 'AI_Screening' | 'Shortlisted' | 'Rejected' | 'Invited' | 'Interviewed';

export interface Candidate {
  id: string;
  job_id: string;
  first_name: string;
  last_name: string;
  email: string;
  linkedin_url: string | null;
  resume_url: string | null;
  status: CandidateStatus;
  created_at: string;
}

export interface ResumeScreening {
  id: string;
  candidate_id: string;
  match_score: number;
  identified_skills: string[];
  missing_skills: string[];
  summary: string | null;
  processed_at: string;
}

export interface Interview {
  id: string;
  candidate_id: string;
  join_token: string;
  status: 'Pending' | 'In_Progress' | 'Completed' | 'No_Show';
  scheduled_start: string | null;
  actual_start: string | null;
  actual_end: string | null;
  recording_url: string | null;
  transcript: TranscriptMessage[];
  created_at: string;
}

export interface TranscriptMessage {
  speaker: 'AI' | 'Candidate';
  text: string;
  timestamp: number;
}

export interface InterviewScorecard {
  id: string;
  interview_id: string;
  overall_score: number;
  technical_score: number;
  communication_score: number;
  problem_solving_score: number;
  culture_fit_score: number;
  behavioral_analysis: Record<string, string>;
  recommendation: 'Strong_Hire' | 'Hire' | 'Maybe' | 'Reject';
  ai_summary: string | null;
  created_at: string;
}

// Extended types with relations (for joined queries)
export interface CandidateWithScreening extends Candidate {
  resume_screenings: ResumeScreening | null;
}

export interface CandidateWithInterview extends Candidate {
  interviews: (Interview & { interview_scorecards: InterviewScorecard | null }) | null;
  resume_screenings: ResumeScreening | null;
}

export interface JobWithCounts extends Job {
  candidates: { count: number }[];
}
