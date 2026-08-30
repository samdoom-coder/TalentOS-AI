import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GitHub Token not configured' }, { status: 500 });
  }

  try {
    const { candidateId, jobId } = await req.json();
    if (!candidateId || !jobId) {
      return NextResponse.json({ error: 'candidateId and jobId required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    // Fetch candidate
    const { data: candidate, error: candErr } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    if (candErr || !candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Fetch job details
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Update candidate status to AI_Screening
    await supabase
      .from('candidates')
      .update({ status: 'AI_Screening' })
      .eq('id', candidateId);

    // Extract text from resume PDF
    let resumeText = '';
    if (candidate.resume_url) {
      try {
        const pdfResponse = await fetch(candidate.resume_url);
        if (pdfResponse.ok) {
          const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const pdfParse = require('pdf-parse');
          const pdfData = await pdfParse(pdfBuffer);
          resumeText = pdfData.text || '';
        }
      } catch (pdfErr) {
        console.error('PDF parse error:', pdfErr);
      }
    }

    if (!resumeText || resumeText.trim().length < 20) {
      // If no resume text found, use basic info
      resumeText = `Candidate: ${candidate.first_name} ${candidate.last_name}, Email: ${candidate.email}`;
      console.log('=== PDF PARSE RETURNED EMPTY, USING FALLBACK ===');
    } else {
      console.log('=== EXTRACTED RESUME TEXT FOR LLM ===');
      console.log(resumeText.substring(0, 500));
      console.log('=====================================');
    }

    // Call GitHub Models API to evaluate resume
    const llmRes = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI resume screener. Analyze the candidate's resume against the job requirements and provide a JSON evaluation with these fields:
- match_score (0-100): how well the candidate matches the job
- identified_skills (string[]): skills found in the resume that match job requirements
- missing_skills (string[]): required skills NOT found in the resume
- summary (string): 2-3 sentence evaluation of the candidate's fit
- document_professionalism (object): for 'attention_to_detail' and 'clarity_and_completeness', provide an object with 'score' (1-5) and 'reasoning' (1-2 sentences)
- cv_red_flags (object): for 'timeline_and_tenure', 'experience_and_representation', 'other_red_flags', provide an object with 'flagged' (boolean) and 'reasoning' (explaining the flag or absence of it)
- key_attributes (object): 'experience_model' (object with 'value' e.g. Hybrid/Remote and 'reasoning'), for 'leadership_potential', 'entrepreneurial_spirit', 'estimated_career_potential' provide object with 'score' (1-5) and 'reasoning'
- professional_profile (object): for each of these 8 metrics ('strategic_focus', 'learning_velocity', 'career_progression', 'drive_and_initiative', 'intellectual_ability', 'managerial_experience', 'recognized_accomplishments', 'original_and_creative_thinking'), provide an object with 'score' (1-5) and 'reasoning'

Respond ONLY with the JSON object, no markdown or extra text.`,
          },
          {
            role: 'user',
            content: `JOB TITLE: ${job.title}
JOB DESCRIPTION: ${job.description || 'Not specified'}
REQUIRED SKILLS: ${(job.required_skills || []).join(', ') || 'Not specified'}

CANDIDATE RESUME:
${resumeText.substring(0, 2000)}`,
          },
        ],
        max_tokens: 3000,
        temperature: 0.3,
      }),
    });

    if (!llmRes.ok) {
      const err = await llmRes.text();
      console.error('GitHub Models API Error:', err);
      // Revert status on failure
      await supabase
        .from('candidates')
        .update({ status: 'Applied' })
        .eq('id', candidateId);
      return NextResponse.json({ error: 'AI screening failed' }, { status: 500 });
    }

    const llmData = await llmRes.json();
    const rawContent = llmData.choices?.[0]?.message?.content || '{}';
    const cleanContent = rawContent.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();

    let screening;
    try {
      screening = JSON.parse(cleanContent);
    } catch {
      console.error('Failed to parse screening response:', rawContent);
      await supabase
        .from('candidates')
        .update({ status: 'Applied' })
        .eq('id', candidateId);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    // Save screening results to resume_screenings table
    const { error: insertErr } = await supabase.from('resume_screenings').insert({
      candidate_id: candidateId,
      match_score: screening.match_score || 0,
      identified_skills: screening.identified_skills || [],
      missing_skills: screening.missing_skills || [],
      summary: screening.summary || '',
      cv_analytics: screening || {},
    });

    if (insertErr) {
      console.error('Insert screening error:', insertErr);
    }

    // Auto-shortlist or reject based on score
      // 5. Dynamic Evaluation Threshold from Settings
      let threshold = 60; // Default fallback
      const { data: jobData } = await supabase.from('jobs').select('user_id').eq('id', jobId).single();
      if (jobData?.user_id) {
        const { data: settingsData } = await supabase
          .from('company_settings')
          .select('auto_reject_threshold')
          .eq('user_id', jobData.user_id)
          .single();
        if (settingsData && settingsData.auto_reject_threshold !== undefined) {
          threshold = settingsData.auto_reject_threshold;
        }
      }

      const isMatch = (screening.match_score || 0) >= threshold;
      const newStatus = isMatch ? 'Shortlisted' : 'Rejected';

    await supabase
      .from('candidates')
      .update({ status: newStatus })
      .eq('id', candidateId);

    return NextResponse.json({
      success: true,
      screening: {
        match_score: screening.match_score,
        identified_skills: screening.identified_skills,
        missing_skills: screening.missing_skills,
        summary: screening.summary,
        status: newStatus,
      },
    });
  } catch (err) {
    console.error('Screen error:', err);
    return NextResponse.json({ error: 'Screening failed' }, { status: 500 });
  }
}
