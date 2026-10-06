import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROXY_IDENTITY_HEADER, verifyProxyIdentity } from "./proxyIdentity";

export async function getRequestAuthContext() {
    const supabase = await createSupabaseServerClient();
    let userId: string | null = null;

    try {
        const requestHeaders = await headers();
        userId = verifyProxyIdentity(requestHeaders.get(PROXY_IDENTITY_HEADER));

        if (!userId) {
            const { data: { user } } = await supabase.auth.getUser();
            userId = user?.id ?? null;
        }
    } catch {
        userId = null;
    }

    return { supabase, userId };
}
