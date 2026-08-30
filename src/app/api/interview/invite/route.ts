import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Resend } from 'resend';
import { randomUUID } from 'crypto';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const { jobId } = await req.json();
    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    // Fetch the job
    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Find shortlisted candidates who do NOT have an interview yet
    const { data: candidates } = await supabase
      .from('candidates')
      .select('*, interviews(id)')
      .eq('job_id', jobId)
      .eq('status', 'Shortlisted');

    const toInvite = (candidates || []).filter(
      (c) => !c.interviews || (Array.isArray(c.interviews) && c.interviews.length === 0)
    );

    if (toInvite.length === 0) {
      return NextResponse.json({ message: 'No shortlisted candidates to invite', invited: 0 });
    }

    // Get the origin from the request headers for building interview links
    const origin = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/[^/]*$/, '') || 'http://localhost:3000';

    // Initialize Resend if API key is available
    const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

    const results = [];

    for (const candidate of toInvite) {
      // Generate unique join token
      const joinToken = randomUUID();

      // Create interview record in Supabase
      const { error: intErr } = await supabase.from('interviews').insert({
        candidate_id: candidate.id,
        join_token: joinToken,
        status: 'Pending',
      });

      if (intErr) {
        console.error(`Failed to create interview for ${candidate.email}:`, intErr);
        results.push({ email: candidate.email, success: false, error: 'Interview creation failed' });
        continue;
      }

      // Update candidate status to Invited
      await supabase
        .from('candidates')
        .update({ status: 'Invited' })
        .eq('id', candidate.id);

      const interviewLink = `${origin}/interview/${joinToken}`;

      // Send email via Resend
      if (resend) {
        try {
          await resend.emails.send({
            from: 'HireAI <onboarding@resend.dev>',
            to: candidate.email,
            subject: `You're invited for an AI Interview — ${job.title}`,
            html: `
              <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a1a; color: #e0e0e0; border-radius: 12px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align: center;">
                  <h1 style="margin: 0; color: white; font-size: 24px;">🎉 Interview Invitation</h1>
                </div>
                <div style="padding: 32px;">
                  <p>Hi <strong>${candidate.first_name}</strong>,</p>
                  <p>Congratulations! After reviewing your resume, you've been shortlisted for the <strong>${job.title}</strong> position.</p>
                  <p>We'd like to invite you to an AI-powered video interview. The interview will be conducted by our AI interviewer and typically takes 15-20 minutes.</p>
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="${interviewLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Start Your Interview →
                    </a>
                  </div>
                  <p style="font-size: 14px; color: #888;">Tips for a great interview:</p>
                  <ul style="font-size: 14px; color: #888;">
                    <li>Use Chrome or Edge for best experience</li>
                    <li>Ensure your camera and microphone are working</li>
                    <li>Find a quiet, well-lit environment</li>
                  </ul>
                  <p style="font-size: 12px; color: #666; margin-top: 32px;">If the button doesn't work, copy this link:<br/>
                    <a href="${interviewLink}" style="color: #8b5cf6;">${interviewLink}</a>
                  </p>
                </div>
                <div style="background: #111128; padding: 16px; text-align: center; font-size: 12px; color: #555;">
                  Powered by HireAI
                </div>
              </div>
            `,
          });
          results.push({ email: candidate.email, success: true, link: interviewLink });
        } catch (emailErr) {
          console.error(`Email send error for ${candidate.email}:`, emailErr);
          results.push({ email: candidate.email, success: true, link: interviewLink, emailSent: false });
        }
      } else {
        // No Resend configured — just create the interview and return link
        results.push({ email: candidate.email, success: true, link: interviewLink, emailSent: false });
      }
    }

    return NextResponse.json({
      invited: results.length,
      results,
      emailEnabled: !!resend,
    });
  } catch (err) {
    console.error('Invite error:', err);
    return NextResponse.json({ error: 'Failed to send invitations' }, { status: 500 });
  }
}
