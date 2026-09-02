import { createClient } from '@supabase/supabase-js';

const getSupabase = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error('SUPABASE_URL is missing or invalid.');
  }

  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing.');
  }

  return createClient(url, key);
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type'
  }
});

const clean = (value, max = 500) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return json({}, 204);
  }

  if (req.method !== 'POST') {
    return json({ error: 'POST required' }, 405);
  }

  try {
    const supabase = getSupabase();
    const input = await req.json();
    const clinic_name = clean(input.clinic_name, 200);

    if (!clinic_name) {
      return json({ error: 'clinic_name is required.' }, 400);
    }

    const lead = {
      place_id: clean(input.place_id, 300),
      clinic_name,
      website: clean(input.website, 1000),
      phone: clean(input.phone, 100),
      address: clean(input.address, 500),
      city: clean(input.city, 100),
      state: clean(input.state, 100),
      zip: clean(input.zip, 20),
      rating: input.rating === null || input.rating === undefined || input.rating === ''
        ? null : Number(input.rating),
      review_count: input.review_count === null || input.review_count === undefined || input.review_count === ''
        ? null : Number(input.review_count),
      source: clean(input.source, 100) || 'manual',
      lead_score: Math.max(0, Math.min(100, Number(input.lead_score) || 0)),
      priority: clean(input.priority, 20) || 'warm',
      ai_reason: clean(input.ai_reason, 2000),
      pain_points: Array.isArray(input.pain_points) ? input.pain_points.slice(0, 20) : [],
      pitch: clean(input.pitch, 3000),
      status: clean(input.status, 50) || 'new',
      outreach_permission: clean(input.outreach_permission, 50) || 'unknown',
      notes: clean(input.notes, 5000),
      email: clean(input.email, 320),
      email_source: clean(input.email_source, 100),
      updated_at: new Date().toISOString()
    };

    if (lead.rating !== null &&
        (!Number.isFinite(lead.rating) || lead.rating < 0 || lead.rating > 5)) {
      return json({ error: 'rating must be between 0 and 5.' }, 400);
    }

    if (lead.review_count !== null &&
        (!Number.isInteger(lead.review_count) || lead.review_count < 0)) {
      return json({ error: 'review_count must be a non-negative integer.' }, 400);
    }

    const query = lead.place_id
      ? supabase.from('pt_leads')
          .upsert(lead, { onConflict: 'place_id', ignoreDuplicates: false })
          .select()
          .single()
      : supabase.from('pt_leads')
          .insert(lead)
          .select()
          .single();

    const { data, error } = await query;

    if (error) {
      console.error('create-lead Supabase error:', error);
      return json({ error: error.message }, 500);
    }

    return json({ ok: true, lead: data });

  } catch (error) {
    console.error('create-lead error:', error);
    return json({
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
};q
