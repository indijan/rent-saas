import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createSupabaseServerClient() {
    const cookieStore = await cookies(); // Next 16: cookies() -> Promise

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options);
                        });
                    } catch {
                        // no-op
                    }
                },
            },
        }
    );
}