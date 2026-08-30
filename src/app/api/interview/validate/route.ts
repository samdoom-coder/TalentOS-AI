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
      .select('*, candidates(*, jobs(*, ai_personas(*)))')
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
        color: persona?.color || '#6366f1',
        systemPrompt: persona?.system_prompt || null,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
