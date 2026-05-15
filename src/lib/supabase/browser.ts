import { createBrowserClient } from "@supabase/ssr";

export const supabaseBrowser = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
        auth: {
            // A jelszó-visszaállítás kliensoldali flow, ezért itt implicit redirectet használunk
            // a PKCE code verifieres visszatérés helyett.
            flowType: "implicit",
        },
    }
);
