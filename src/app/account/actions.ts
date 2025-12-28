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
        redirect("/account?status=error&message=A+n%C3%A9v+megad%C3%A1sa+k%C3%B6telez%C5%91.");
    }

    const { error } = await supabase
        .from("profiles")
        .update({ full_name })
        .eq("id", user.id);

    if (error) {
        redirect(`/account?status=error&message=${encodeURIComponent(error.message)}`);
    }
    redirect("/account?status=success&message=N%C3%A9v+elmentve.");
}

export async function updatePassword(formData: FormData) {
    const supabase = await createSupabaseServerClient();
    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("password_confirm") || "");

    if (!password || password.length < 8) {
        redirect("/account?status=error&message=A+jelsz%C3%B3nak+legal%C3%A1bb+8+karakter+hossz%C3%BAnak+kell+lennie.");
    }
    if (password !== confirm) {
        redirect("/account?status=error&message=A+jelszavak+nem+egyeznek.");
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
        redirect(`/account?status=error&message=${encodeURIComponent(error.message)}`);
    }
    redirect("/account?status=success&message=Jelsz%C3%B3+elmentve.");
}
