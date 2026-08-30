import { NextRequest, NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export async function POST(req: NextRequest) {
  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GitHub Token not configured' }, { status: 500 });
  }

  try {
    const { candidateText, history, systemPrompt, jobTitle, candidateName, companyName, strictnessLevel, resumeContext } = await req.json();

    if (!candidateText || candidateText.trim() === '') {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // Determine strictness instructions
    let strictnessGuideline = "Evaluate technical knowledge, communication skills, and problem-solving ability fairly.";
    if (strictnessLevel === 'Lenient') {
      strictnessGuideline = "Be extremely encouraging and forgiving of mistakes. Focus heavily on culture fit and potential rather than perfect technical answers.";
    } else if (strictnessLevel === 'Strict') {
      strictnessGuideline = "Be highly rigorous and skeptical. Probe deeply into technical claims and do not accept surface-level answers. Maintain a formal, demanding tone.";
    }

    // Build system prompt
    const basePrompt = systemPrompt || `You are a professional AI interviewer representing ${companyName || 'HireAI'}, conducting a job interview for the position of "${jobTitle || 'this role'}". 

Guidelines:
- Be professional, friendly, and encouraging.
- Ask one question at a time, building on the candidate's responses.
- ${strictnessGuideline}
- Keep responses concise (2-4 sentences max).
- If the candidate asks you to repeat, paraphrase your previous question.`;

    let resumeGuideline = "";
    if (resumeContext) {
      resumeGuideline = `\n\n[CRITICAL CONTEXT: RESUME ANALYSIS]\nPrior to this interview, the candidate's resume was analyzed with the following results:\n${resumeContext}\n\nPlease heavily tailor your questions to address their specific background, diving into their identified skills and asking them to elaborate on any missing skills.`;
    }

    const finalSystemPrompt = `${basePrompt}${resumeGuideline}

CRITICAL DIRECTIVE FOR INTERVIEW PACING:
1. You MUST ask exactly ONE question from your interview plan at a time.
2. DO NOT ask a compound question. DO NOT list all your questions at once.
3. You MUST wait for the candidate to provide their answer before moving on to the next topic.
4. Briefly acknowledge or validate the candidate's answer before asking the next question.

The candidate's name is ${candidateName || 'the candidate'}. 
You are interviewing them on behalf of ${companyName || 'the company'}.`;

    const messages = [
      { role: 'system', content: finalSystemPrompt },
      ...(history || []),
      { role: 'user', content: candidateText },
    ];

    // Call GitHub Models API
    const llmRes = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!llmRes.ok) {
      const err = await llmRes.text();
      console.error('GitHub Models API Error:', err);
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
