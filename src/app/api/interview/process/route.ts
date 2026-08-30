import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export async function POST(req: NextRequest) {
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 });
  }

  try {
    const { candidateText, history, systemPrompt, jobTitle, candidateName } = await req.json();

    if (!candidateText || candidateText.trim() === '') {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // Build system prompt
    const finalSystemPrompt = systemPrompt || `You are a professional AI interviewer conducting a job interview for the position of "${jobTitle || 'this role'}". 

Guidelines:
- Be professional, friendly, and encouraging.
- Ask one question at a time, building on the candidate's responses.
- Evaluate technical knowledge, communication skills, and problem-solving ability.
- Keep responses concise (2-4 sentences max).
- If the candidate asks you to repeat, paraphrase your previous question.
- Start with a warm greeting if this is the first message.
- The candidate's name is ${candidateName || 'the candidate'}.`;

    const messages = [
      { role: 'system', content: finalSystemPrompt },
      ...(history || []),
      { role: 'user', content: candidateText },
    ];

    // Call OpenRouter (OpenAI-compatible API)
    const llmRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'HireAI Interview Platform',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages,
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!llmRes.ok) {
      const err = await llmRes.text();
      console.error('OpenRouter Error:', err);
      return NextResponse.json({ error: 'AI response generation failed' }, { status: 500 });
    }

    const llmData = await llmRes.json();
    const aiText = llmData.choices?.[0]?.message?.content || 'I apologize, could you please repeat that?';

    return NextResponse.json({ aiText });
  } catch (err) {
    console.error('Process error:', err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
