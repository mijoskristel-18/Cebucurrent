import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requestSignals, sameOrigin, validEmail } from "@/lib/security";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { email, password } = (body || {}) as { email?: unknown; password?: unknown };
  if (!validEmail(email) || typeof password !== "string" || password.length < 1 || password.length > 128) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 400 });
  }
  const normalizedEmail = email.toLowerCase();
  const signals = requestSignals(request);
  const admin = createSupabaseAdminClient();
  const { data: rawGate, error: gateError } = await admin.rpc("cebu_check_login_gate", {
    p_email: normalizedEmail, p_ip: signals.ip, p_user_agent: signals.userAgent,
    p_city: signals.city, p_region: signals.region, p_country: signals.country,
  }).maybeSingle();
  const gate = rawGate as { allowed: boolean; seconds_remaining: number } | null;
  if (gateError) {
    console.error("Login protection check failed", gateError.message);
    return NextResponse.json({ error: "Sign-in protection is temporarily unavailable. Try again shortly." }, { status: 503 });
  }
  if (!gate?.allowed) {
    const seconds = Math.max(1, Number(gate?.seconds_remaining) || 300);
    return NextResponse.json({ error: `Too many failed attempts. Try again in ${Math.ceil(seconds / 60)} minute(s).` }, { status: 429 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
  if (error && error.code !== "invalid_credentials") {
    if (error.code === "email_not_confirmed") {
      return NextResponse.json({ error: "Verify your email address before signing in." }, { status: 401 });
    }
    console.error("Sign-in provider error", error.status, error.code);
    return NextResponse.json({ error: "The sign-in service is temporarily unavailable. Please try again." }, { status: 503 });
  }
  if (error || !data.user) {
    const { data: rawFailure, error: failureError } = await admin.rpc("cebu_record_login_failure", {
      p_email: normalizedEmail, p_ip: signals.ip, p_user_agent: signals.userAgent,
      p_city: signals.city, p_region: signals.region, p_country: signals.country,
    }).single();
    const failure = rawFailure as { locked: boolean; attempts_remaining: number } | null;
    if (failureError) console.error("Could not record failed sign-in", failureError.message);
    const locked = Boolean(failure?.locked);
    const remaining = Number(failure?.attempts_remaining);
    const message = locked
      ? "Three failed attempts were detected. Sign-in is paused for five minutes. A security alert is saved to this account."
      : "Email or password is incorrect. If this account exists, the attempt is saved in its security alerts.";
    return NextResponse.json({ error: message, attemptsRemaining: Number.isFinite(remaining) ? remaining : null }, { status: locked ? 429 : 401 });
  }

  const { error: resetError } = await admin.rpc("cebu_clear_login_guard", { p_email: normalizedEmail });
  if (resetError) console.error("Could not clear successful login counter", resetError.message);
  return NextResponse.json({ ok: true });
}
