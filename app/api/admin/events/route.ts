import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admins = (process.env.ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (!user?.email || !admins.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }
  const admin = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin.from("cebu_security_events")
    .select("id,attempted_email,event_type,ip_address,city,region,country,user_agent,created_at")
    .gte("created_at", cutoff).order("created_at", { ascending: false }).limit(200);
  if (error) {
    console.error("Could not load admin events", error.message);
    return NextResponse.json({ error: "Could not load security events." }, { status: 500 });
  }
  return NextResponse.json({ events: data }, { headers: { "Cache-Control": "no-store" } });
}
