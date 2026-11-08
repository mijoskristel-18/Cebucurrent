import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = new URL("/", request.url);
  if (!code) {
    destination.searchParams.set("verified", "error");
    return NextResponse.redirect(destination);
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  destination.searchParams.set("verified", error ? "error" : "1");
  return NextResponse.redirect(destination);
}
