import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicConfig } from "@/lib/config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = publicConfig();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
}
