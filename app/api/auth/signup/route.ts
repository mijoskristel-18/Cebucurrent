import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sameOrigin, validEmail } from "@/lib/security";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const { email, password } = (body || {}) as { email?: unknown; password?: unknown };
  if (!validEmail(email) || typeof password !== "string" || password.length < 10 || password.length > 128) {
    return NextResponse.json({ error: "Use a valid email and a password between 10 and 128 characters." }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({ email: email.toLowerCase(), password, options: { emailRedirectTo: new URL("/auth/callback", request.url).toString() } });
  if (error) console.warn("Signup rejected", error.status, error.code);
  return NextResponse.json({ message: "If this address can be registered, a verification email is on its way." });
}
