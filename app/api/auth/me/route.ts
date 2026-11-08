import { NextResponse } from "next/server";
import { isConfigured } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isConfigured()) return NextResponse.json({ configured: false, user: null });
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admins = (process.env.ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  return NextResponse.json({ configured: true, user: user?.email ? { email: user.email, isAdmin: admins.includes(user.email.toLowerCase()) } : null }, { headers: { "Cache-Control": "no-store" } });
}
