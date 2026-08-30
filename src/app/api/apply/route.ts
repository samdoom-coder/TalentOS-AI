import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const jobId = formData.get('jobId') as string;
    const resumeFile = formData.get('resume') as File | null;

    if (!jobId || !resumeFile || resumeFile.size === 0) {
      return NextResponse.json({ resumeUrl: null });
    }

    // Use service role key for storage (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    // Pick the best available key
    const apiKey = (serviceKey && serviceKey.length > 30 && !serviceKey.includes('your-')) 
      ? serviceKey 
      : anonKey;

    console.log('[UPLOAD] Using key type:', apiKey === serviceKey ? 'SERVICE_ROLE' : 'ANON');
    console.log('[UPLOAD] File:', resumeFile.name, 'size:', resumeFile.size);

    const supabase = createClient(supabaseUrl, apiKey);
    const fileBuffer = Buffer.from(await resumeFile.arrayBuffer());
    const filePath = `${jobId}/${Date.now()}_${resumeFile.name}`;

    const { data, error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(filePath, fileBuffer, {
        contentType: resumeFile.type || 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('[UPLOAD] ❌ Failed:', JSON.stringify(uploadError));
      return NextResponse.json({ resumeUrl: null, error: uploadError.message }, { status: 400 });
    }

    const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(filePath);
    console.log('[UPLOAD] ✅ Success:', data?.path, '→', urlData.publicUrl);

    return NextResponse.json({ resumeUrl: urlData.publicUrl });
  } catch (err) {
    console.error('[UPLOAD] Error:', err);
    return NextResponse.json({ resumeUrl: null, error: 'Upload failed' }, { status: 500 });
  }
}
