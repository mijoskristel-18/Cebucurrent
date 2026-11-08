import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Sign in to view account alerts." }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin.from("cebu_security_events")
    .select("id,event_type,ip_address,city,region,country,user_agent,created_at")
    .eq("attempted_email", user.email.toLowerCase())
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("Could not load account security alerts", error.message);
    return NextResponse.json({ error: "Could not load account alerts." }, { status: 500 });
  }
  return NextResponse.json({ notifications: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
