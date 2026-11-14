import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface NotificationRecord {
  id: string;
  event_type: 'rsvp_created' | 'wish_created';
  guest_name: string;
  message: string;
  reference_table: 'rsvps' | 'wishes';
  reference_id: string;
  metadata?: {
    push_title?: string;
    push_body?: string;
    attendee_count?: number;
  };
  created_at: string;
}

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/\\n/g, '\n')
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getGoogleAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3500,
  };

  const unsignedJwt = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claimSet))}`;
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedJwt)
  );

  const signedJwt = `${unsignedJwt}.${base64UrlEncode(new Uint8Array(signature))}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Google OAuth error: ${errText}`);
  }

  const tokenJson = await tokenRes.json();
  return tokenJson.access_token as string;
}

Deno.serve(async (req: Request) => {
  try {
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
    if (webhookSecret && req.headers.get('x-webhook-secret') !== webhookSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized webhook' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    const record: NotificationRecord | undefined = payload?.record;
    if (!record || !record.id) {
      return new Response(JSON.stringify({ error: 'Invalid webhook record' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const firebaseProjectId = Deno.env.get('FIREBASE_PROJECT_ID') ?? '';
    const firebaseClientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL') ?? '';
    const firebasePrivateKey = Deno.env.get('FIREBASE_PRIVATE_KEY') ?? '';

    if (!firebaseProjectId || !firebaseClientEmail || !firebasePrivateKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Firebase service account secrets' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Only send to administrators who enabled push notifications for this event type
    let adminQuery = supabaseAdmin
      .from('admin_users')
      .select('user_id')
      .eq('push_enabled', true);

    if (record.event_type === 'rsvp_created') {
      adminQuery = adminQuery.eq('rsvp_push_enabled', true);
    } else if (record.event_type === 'wish_created') {
      adminQuery = adminQuery.eq('wish_push_enabled', true);
    }

    const { data: eligibleAdmins, error: adminErr } = await adminQuery;
    if (adminErr) throw adminErr;

    const eligibleUserIds = (eligibleAdmins ?? []).map((a) => a.user_id);
    if (eligibleUserIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'No eligible admins' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: devices, error: devErr } = await supabaseAdmin
      .from('admin_devices')
      .select('id, device_token, user_id')
      .eq('is_active', true)
      .eq('platform', 'android')
      .in('user_id', eligibleUserIds);

    if (devErr) throw devErr;
    if (!devices || devices.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'No registered devices' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const pushTitle =
      record.metadata?.push_title ??
      (record.event_type === 'rsvp_created'
        ? 'ახალი დასწრების დადასტურება 💍'
        : 'ახალი სურვილი 💌');

    const pushBody = record.metadata?.push_body ?? record.message;

    const accessToken = await getGoogleAccessToken(firebaseClientEmail, firebasePrivateKey);
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`;

    let sentCount = 0;
    const staleDeviceIds: string[] = [];

    for (const device of devices) {
      // Data-only payload ensures WeddingFirebaseMessagingService.onMessageReceived runs
      // in both foreground and background so local preferences and deduplication apply.
      const fcmBody = {
        message: {
          token: device.device_token,
          data: {
            title: pushTitle,
            body: pushBody,
            event_type: record.event_type,
            reference_table: record.reference_table,
            reference_id: record.reference_id,
            notification_id: record.id,
          },
          android: {
            priority: 'HIGH',
          },
        },
      };

      const fcmRes = await fetch(fcmEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fcmBody),
      });

      if (fcmRes.ok) {
        sentCount++;
      } else {
        const errDetail = await fcmRes.text();
        if (errDetail.includes('UNREGISTERED') || errDetail.includes('NOT_FOUND')) {
          staleDeviceIds.push(device.id);
        }
      }
    }

    if (staleDeviceIds.length > 0) {
      await supabaseAdmin
        .from('admin_devices')
        .update({ is_active: false })
        .in('id', staleDeviceIds);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sent: sentCount,
        total_devices: devices.length,
        pruned_stale: staleDeviceIds.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});