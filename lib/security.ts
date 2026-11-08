import type { NextRequest } from "next/server";

export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export function requestSignals(request: NextRequest) {
  const forwarded = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || null;
  const userAgent = (request.headers.get("user-agent") || "Unknown browser").slice(0, 700);
  const decode = (value: string | null) => {
    if (!value) return null;
    try { return decodeURIComponent(value).slice(0, 100); } catch { return value.slice(0, 100); }
  };
  const city = decode(request.headers.get("x-vercel-ip-city"));
  const region = decode(request.headers.get("x-vercel-ip-country-region"));
  const country = decode(request.headers.get("x-vercel-ip-country"));
  return { ip, userAgent, city, region, country };
}

export function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
