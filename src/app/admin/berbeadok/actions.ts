"use server";

import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderOwnerInviteEmail } from "@/lib/email/templates";

export async function createOwner(formData: FormData) {
    await requireRole("ADMIN");

    const fullName = String(formData.get("full_name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();

    if (!fullName || !email) {
        return { ok: false, error: "Név és e-mail-cím kötelező." };
    }

    const admin = createSupabaseAdminClient();
    const { data: existing, error: existingError } = await admin
        .from("profiles")
        .select("id,role")
        .eq("email", email)
        .maybeSingle();

    if (existingError) return { ok: false, error: existingError.message };

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
    const redirectTo = siteUrl ? `${siteUrl}/auth/callback?next=/account` : undefined;

    if (existing?.id) {
        const { error: membershipError } = await admin
            .from("owner_memberships")
            .upsert({ user_id: existing.id }, { onConflict: "user_id" });
        if (membershipError) return { ok: false, error: membershipError.message };

        if (existing.role !== "ADMIN" && existing.role !== "OWNER") {
            const { error: profileError } = await admin
                .from("profiles")
                .update({ full_name: fullName })
                .eq("id", existing.id);
            if (profileError) return { ok: false, error: profileError.message };
        }

        const emailPayload = renderOwnerInviteEmail({
            ownerEmail: email,
            ownerName: fullName,
            inviteLink: `${siteUrl}/login`,
            existingAccount: true,
        });
        const emailRes = await sendEmail(emailPayload);
        if (!emailRes.ok) {
            return { ok: false, error: emailRes.error ?? "A bérbeadó értesítése nem sikerült." };
        }

        return { ok: true };
    }

    const { data, error } = await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
            redirectTo,
        },
    });

    if (error || !data?.properties?.action_link) {
        return { ok: false, error: error?.message || "Meghívó link hiba." };
    }

    const userId = data.user?.id;
    if (userId) {
        const { error: profileError } = await admin
            .from("profiles")
            .upsert({
                id: userId,
                email,
                full_name: fullName,
                role: "OWNER",
            });
        if (profileError) return { ok: false, error: profileError.message };

        const { error: membershipError } = await admin
            .from("owner_memberships")
            .upsert({ user_id: userId }, { onConflict: "user_id" });
        if (membershipError) return { ok: false, error: membershipError.message };
    }

    const emailPayload = renderOwnerInviteEmail({
        ownerEmail: email,
        ownerName: fullName,
        inviteLink: data.properties.action_link,
    });
    const emailRes = await sendEmail(emailPayload);
    if (!emailRes.ok) {
        return { ok: false, error: emailRes.error ?? "A bérbeadó értesítése nem sikerült." };
    }

    return { ok: true };
}
