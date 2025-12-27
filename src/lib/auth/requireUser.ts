import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppRole = "ADMIN" | "OWNER" | "TENANT";

export async function requireUser() {
    const supabase = await createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("id,email,role,full_name")
        .eq("id", user.id)
        .single();

    if (error || !profile) redirect("/login");

    return { supabase, user, profile: profile as { id: string; email: string; role: AppRole; full_name: string | null } };
}