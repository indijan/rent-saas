"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderTenantDeletionRequestEmail } from "@/lib/email/templates";
import { removeDocumentObjects } from "@/lib/documentStorage";

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

export async function deleteProfile(formData: FormData) {
    const { supabase, user, profile } = await requireUser();
    const confirmation = String(formData.get("confirmation") || "").trim();

    if (confirmation !== "DELETE") {
        redirect("/account?status=error&message=A+t%C3%B6rl%C3%A9shez+pontosan+a+DELETE+sz%C3%B3t+kell+megadnod.");
    }

    if (profile.role === "TENANT" && (profile.available_roles?.length ?? 0) === 1) {
        redirect("/account?status=error&message=B%C3%A9rl%C5%91k%C3%A9nt+k%C3%B6zvetlen+t%C3%B6rl%C3%A9s+helyett+t%C3%B6rl%C3%A9si+k%C3%A9relmet+tudsz+k%C3%BCldeni.");
    }

    const admin = createSupabaseAdminClient();
    const paths = new Set<string>();

    const [{ data: ownerDocuments }, { data: ownerIngestions }] = await Promise.all([
        admin.from("documents").select("bucket_path").eq("owner_id", user.id),
        admin.from("document_ingestions").select("storage_key").eq("owner_id", user.id),
    ]);

    (ownerDocuments ?? []).forEach((row) => {
        const path = row.bucket_path as string | null;
        if (path) paths.add(path);
    });
    (ownerIngestions ?? []).forEach((row) => {
        const path = row.storage_key as string | null;
        if (path) paths.add(path);
    });

    if (paths.size > 0) {
        await removeDocumentObjects(Array.from(paths));
    }

    await admin.from("property_import_aliases").delete().eq("owner_id", user.id);
    await admin.from("supplier_profiles").delete().eq("owner_id", user.id);
    await admin.from("extraction_reviews").delete().eq("reviewed_by", user.id);
    await admin.from("document_fingerprints").delete().eq("owner_id", user.id);
    await admin.from("documents").delete().eq("owner_id", user.id);
    await admin.from("charges").delete().eq("owner_id", user.id);
    await admin.from("document_ingestions").delete().eq("owner_id", user.id);
    await admin.from("inbound_mailboxes").delete().eq("owner_id", user.id);
    await admin.from("properties").update({ tenant_id: null }).eq("tenant_id", user.id);
    await admin.from("charges").update({ tenant_id: null }).eq("tenant_id", user.id);
    await admin.from("documents").update({ tenant_id: null }).eq("tenant_id", user.id);
    await admin.from("properties").delete().eq("owner_id", user.id);
    await admin.from("tenant_memberships").delete().eq("user_id", user.id);
    await admin.from("tenant_memberships").delete().eq("owner_id", user.id);
    await admin.from("owner_memberships").delete().eq("user_id", user.id);
    await admin.from("profiles").delete().eq("id", user.id);
    await admin.auth.admin.deleteUser(user.id);

    await supabase.auth.signOut();
    redirect("/login?status=success&message=A+fi%C3%B3k+%C3%A9s+a+kapcsol%C3%B3d%C3%B3+dokumentumok+t%C3%B6r%C3%B6lve.");
}

export async function requestTenantProfileDeletion() {
    const { user, profile } = await requireUser();

    const admin = createSupabaseAdminClient();
    const ownerIds = new Set<string>();

    const [{ data: memberships }, { data: propertyOwners }] = await Promise.all([
        admin.from("tenant_memberships").select("owner_id").eq("user_id", user.id),
        admin.from("properties").select("owner_id").eq("tenant_id", user.id),
    ]);

    (memberships ?? []).forEach((row) => {
        const ownerId = row.owner_id as string | null;
        if (ownerId) ownerIds.add(ownerId);
    });
    (propertyOwners ?? []).forEach((row) => {
        const ownerId = row.owner_id as string | null;
        if (ownerId) ownerIds.add(ownerId);
    });

    if (ownerIds.size === 0) {
        redirect("/account?status=error&message=Nem+tal%C3%A1lhat%C3%B3+olyan+b%C3%A9rbead%C3%B3%2C+akinek+t%C3%B6rl%C3%A9si+k%C3%A9relmet+lehetne+k%C3%BCldeni.");
    }

    const { data: owners } = await admin
        .from("profiles")
        .select("id,email,full_name")
        .in("id", Array.from(ownerIds));

    for (const owner of owners ?? []) {
        if (!owner.email) continue;
        await sendEmail(renderTenantDeletionRequestEmail({
            ownerEmail: owner.email,
            ownerName: owner.full_name ?? null,
            tenantName: profile.full_name ?? null,
            tenantEmail: profile.email,
        }));
    }

    redirect("/account?status=success&message=A+t%C3%B6rl%C3%A9si+k%C3%A9relem+elk%C3%BCldve+a+b%C3%A9rbead%C3%B3nak.");
}
