import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const { interviewId, transcript } = await req.json();
    if (!interviewId) return NextResponse.json({ error: 'Interview ID required' }, { status: 400 });

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    // Save transcript to interview
    await supabase
      .from('interviews')
      .update({
        status: 'Completed',
        transcript: transcript,
        actual_end: new Date().toISOString(),
      })
      .eq('id', interviewId);

    // Update candidate status
    const { data: interview } = await supabase
      .from('interviews')
      .select('candidate_id')
      .eq('id', interviewId)
      .single();

    if (interview?.candidate_id) {
      await supabase
        .from('candidates')
        .update({ status: 'Interviewed' })
        .eq('id', interview.candidate_id);
    }

    // AI Scoring via OpenRouter
    let scorecard = null;
    if (OPENROUTER_API_KEY && transcript && transcript.length > 1) {
      const fullTranscript = transcript
        .map((m: { speaker: string; text: string }) => `${m.speaker}: ${m.text}`)
        .join('\n');

      const scoringRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'X-Title': 'HireAI Interview Platform',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an AI interview evaluator. Analyze the following interview transcript and provide a JSON scorecard with these fields:
              - overall_score (0-100)
              - technical_score (0-100)
              - communication_score (0-100)
              - problem_solving_score (0-100)
              - culture_fit_score (0-100)
              - recommendation ("Strong_Hire", "Hire", "Maybe", or "Reject")
              - ai_summary (2-3 sentence evaluation)
              
              Respond ONLY with the JSON object, no markdown.`,
            },
            { role: 'user', content: fullTranscript },
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
      });

      if (scoringRes.ok) {
        const scoringData = await scoringRes.json();
        const rawContent = scoringData.choices?.[0]?.message?.content || '{}';
        try {
          scorecard = JSON.parse(rawContent);
          await supabase.from('interview_scorecards').insert({
            interview_id: interviewId,
            overall_score: scorecard.overall_score || 0,
            technical_score: scorecard.technical_score || 0,
            communication_score: scorecard.communication_score || 0,
            problem_solving_score: scorecard.problem_solving_score || 0,
            culture_fit_score: scorecard.culture_fit_score || 0,
            recommendation: scorecard.recommendation || 'Maybe',
            ai_summary: scorecard.ai_summary || '',
          });
        } catch {
          console.error('Failed to parse scoring response:', rawContent);
        }
      }
    }

    return NextResponse.json({ success: true, scorecard });
  } catch (err) {
    console.error('Complete error:', err);
    return NextResponse.json({ error: 'Failed to complete interview' }, { status: 500 });
  }
}
