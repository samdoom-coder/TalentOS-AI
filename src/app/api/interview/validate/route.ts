import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    // Find interview by token
    const { data: interview, error: intError } = await supabase
      .from('interviews')
      .select('*, candidates(*, jobs(*, ai_personas(*)), resume_screenings(*))')
      .eq('join_token', token)
      .single();

    if (intError || !interview) {
      return NextResponse.json({ error: 'Invalid or expired interview link' }, { status: 404 });
    }

    if (interview.status === 'Completed') {
      return NextResponse.json({ error: 'This interview has already been completed' }, { status: 400 });
    }

    const candidate = interview.candidates;
    const job = candidate?.jobs;
    const persona = job?.ai_personas;

    // Extract resume context
    const screening = Array.isArray(candidate?.resume_screenings) && candidate.resume_screenings.length > 0 
      ? candidate.resume_screenings[0] 
      : (candidate?.resume_screenings && !Array.isArray(candidate.resume_screenings) ? candidate.resume_screenings : null);
    
    let resumeContext: string | null = null;
    if (screening && (screening.summary || screening.identified_skills?.length > 0)) {
      resumeContext = `Candidate Background Summary: ${screening.summary || 'None provided'}\nIdentified Skills: ${(screening.identified_skills || []).join(', ')}\nMissing Skills: ${(screening.missing_skills || []).join(', ')}`;
    }

    // Fetch company settings
    let companyName = 'HireAI';
    let strictness = 'Normal';
    if (job?.user_id) {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('company_name, strictness_level')
        .eq('user_id', job.user_id)
        .single();
      if (settings?.company_name) companyName = settings.company_name;
      if (settings?.strictness_level) strictness = settings.strictness_level;
    }

    return NextResponse.json({
      interviewId: interview.id,
      candidate: {
        name: `${candidate.first_name} ${candidate.last_name}`,
        email: candidate.email,
      },
      job: {
        title: job?.title || 'Interview',
        description: job?.description || '',
      },
      persona: {
        name: persona?.name || 'AI Interviewer',
        role: persona?.role || 'Interviewer',
        color: persona?.color || '#2563eb',
        systemPrompt: persona?.system_prompt || null,
      },
      company: {
        name: companyName,
        strictness: strictness
      },
      resumeContext
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
