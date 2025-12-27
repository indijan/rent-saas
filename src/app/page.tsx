import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
    const supabase = await createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (error || !profile) redirect("/login");

    if (profile.role === "ADMIN") redirect("/admin/users");
    if (profile.role === "OWNER") redirect("/owner/properties");
    redirect("/tenant/charges");
}