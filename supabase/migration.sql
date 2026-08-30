-- =====================================================
-- HireAI Database Schema Migration
-- Run this SQL in the Supabase SQL Editor (Dashboard > SQL)
-- =====================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. AI PERSONAS
-- =====================================================
CREATE TABLE ai_personas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  voice_id TEXT,
  avatar_url TEXT,
  system_prompt TEXT,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own personas"
  ON ai_personas FOR ALL
  USING (auth.uid() = user_id);

-- =====================================================
-- 2. JOBS
-- =====================================================
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_persona_id UUID REFERENCES ai_personas(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  job_type TEXT DEFAULT 'Full-time',
  required_skills JSONB DEFAULT '[]',
  scoring_rubric JSONB DEFAULT '{}',
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Closed', 'Draft')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own jobs"
  ON jobs FOR ALL
  USING (auth.uid() = user_id);

-- Allow public to READ active jobs (for the apply page)
CREATE POLICY "Anyone can view active jobs"
  ON jobs FOR SELECT
  USING (status = 'Active');

-- =====================================================
-- 3. CANDIDATES
-- =====================================================
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  linkedin_url TEXT,
  resume_url TEXT,
  status TEXT DEFAULT 'Applied' CHECK (status IN ('Applied', 'AI_Screening', 'Shortlisted', 'Rejected', 'Invited', 'Interviewed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- Job owners can see all candidates for their jobs
CREATE POLICY "Job owners can manage candidates"
  ON candidates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM jobs WHERE jobs.id = candidates.job_id AND jobs.user_id = auth.uid()
    )
  );

-- Allow public to INSERT candidates (for the apply page)
CREATE POLICY "Anyone can apply as candidate"
  ON candidates FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 4. RESUME SCREENINGS
-- =====================================================
CREATE TABLE resume_screenings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE UNIQUE,
  match_score INTEGER DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
  identified_skills JSONB DEFAULT '[]',
  missing_skills JSONB DEFAULT '[]',
  summary TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE resume_screenings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Job owners can view screenings"
  ON resume_screenings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM candidates
      JOIN jobs ON jobs.id = candidates.job_id
      WHERE candidates.id = resume_screenings.candidate_id
      AND jobs.user_id = auth.uid()
    )
  );

-- =====================================================
-- 5. INTERVIEWS
-- =====================================================
CREATE TABLE interviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE UNIQUE,
  join_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In_Progress', 'Completed', 'No_Show')),
  scheduled_start TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  recording_url TEXT,
  transcript JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Job owners can manage interviews"
  ON interviews FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM candidates
      JOIN jobs ON jobs.id = candidates.job_id
      WHERE candidates.id = interviews.candidate_id
      AND jobs.user_id = auth.uid()
    )
  );

-- Allow public to read their own interview by token (for the interview page)
CREATE POLICY "Candidates can access interview by token"
  ON interviews FOR SELECT
  USING (true);

-- =====================================================
-- 6. INTERVIEW SCORECARDS
-- =====================================================
CREATE TABLE interview_scorecards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE UNIQUE,
  overall_score INTEGER DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
  technical_score INTEGER DEFAULT 0,
  communication_score INTEGER DEFAULT 0,
  problem_solving_score INTEGER DEFAULT 0,
  culture_fit_score INTEGER DEFAULT 0,
  behavioral_analysis JSONB DEFAULT '{}',
  recommendation TEXT CHECK (recommendation IN ('Strong_Hire', 'Hire', 'Maybe', 'Reject')),
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE interview_scorecards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Job owners can view scorecards"
  ON interview_scorecards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM interviews
      JOIN candidates ON candidates.id = interviews.candidate_id
      JOIN jobs ON jobs.id = candidates.job_id
      WHERE interviews.id = interview_scorecards.interview_id
      AND jobs.user_id = auth.uid()
    )
  );

-- =====================================================
-- STORAGE BUCKETS (Run these separately if needed)
-- =====================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('recordings', 'recordings', false);
