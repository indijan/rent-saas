"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/requireUser";

export async function logout() {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
}

export async function updateProfile(formData: FormData) {
    const { supabase, user } = await requireUser();
    const full_name = String(formData.get("full_name") || "").trim();

    if (!full_name) {
        return { ok: false, error: "A név megadása kötelező." };
    }

    const { error } = await supabase
        .from("profiles")
        .update({ full_name })
        .eq("id", user.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
}

export async function updatePassword(formData: FormData) {
    const supabase = await createSupabaseServerClient();
    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("password_confirm") || "");

    if (!password || password.length < 8) {
        return { ok: false, error: "A jelszónak legalább 8 karakter hosszúnak kell lennie." };
    }
    if (password !== confirm) {
        return { ok: false, error: "A jelszavak nem egyeznek." };
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
}
