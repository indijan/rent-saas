import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSignedInDashboardHref() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user ? "/dashboard" : null;
}
