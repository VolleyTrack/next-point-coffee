const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export interface SignupRow {
  id: string;
  email: string;
  context: string;
  created_at: string;
}

function assertConfigured() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase env vars (SUPABASE_URL, SUPABASE_SERVICE_KEY) are not configured.");
  }
}

export async function addSignup(email: string, context: string): Promise<{ alreadySubscribed: boolean }> {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/newsletter_signups`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_KEY as string,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify([{ email: email.toLowerCase().trim(), context }]),
  });

  if (res.status === 409) {
    // Unique index on lower(email) rejected a duplicate signup — treat as success.
    return { alreadySubscribed: true };
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase insert failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return { alreadySubscribed: Array.isArray(data) && data.length === 0 };
}

export async function listSignups(): Promise<SignupRow[]> {
  assertConfigured();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/newsletter_signups?select=id,email,context,created_at&order=created_at.desc`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY as string,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase select failed: ${res.status} ${text}`);
  }

  return res.json();
}
