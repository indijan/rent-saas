"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderTenantExitRequestEmail } from "@/lib/email/templates";
import { removeDocumentObjects } from "@/lib/documentStorage";
import { listTenantProperties } from "@/lib/propertyTenants";

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

    const admin = createSupabaseAdminClient();
    const tenantOnly = profile.role === "TENANT" && (profile.available_roles?.length ?? 0) === 1;

    if (tenantOnly) {
        const activeProperties = await listTenantProperties(user.id);
        if (activeProperties.length > 0) {
            redirect("/account?status=error&message=A+v%C3%A9gleges+t%C3%B6rl%C3%A9s+el%C5%91tt+minden+ingatlanr%C3%B3l+le+kell+ker%C3%BCln%C3%B6d.+K%C3%BCldj+kil%C3%A9p%C3%A9si+k%C3%A9relmet.");
        }

        await admin.from("tenant_exit_requests").delete().eq("tenant_id", user.id);
        await admin.from("property_tenants").delete().eq("tenant_id", user.id);
        await admin.from("tenant_memberships").delete().eq("user_id", user.id);
        await admin.from("charges").update({ tenant_id: null }).eq("tenant_id", user.id);
        await admin.from("documents").update({ tenant_id: null }).eq("tenant_id", user.id);
        await admin.from("properties").update({ tenant_id: null }).eq("tenant_id", user.id);
        await admin.from("profiles").delete().eq("id", user.id);
        await admin.auth.admin.deleteUser(user.id);

        await supabase.auth.signOut();
        redirect("/login?status=success&message=A+b%C3%A9rl%C5%91i+fi%C3%B3k+t%C3%B6r%C3%B6lve.+A+dokumentumok+megmaradtak+a+b%C3%A9rbead%C3%B3n%C3%A1l.");
    }

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
    await admin.from("tenant_exit_requests").delete().eq("owner_id", user.id);
    await admin.from("tenant_exit_requests").delete().eq("tenant_id", user.id);
    await admin.from("property_tenants").delete().eq("owner_id", user.id);
    await admin.from("property_tenants").delete().eq("tenant_id", user.id);
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
    const activeProperties = await listTenantProperties(user.id);

    if (activeProperties.length === 0) {
        redirect("/account?status=success&message=Nincs+akt%C3%ADv+ingatlan-hozz%C3%A1rendel%C3%A9sed.+Most+m%C3%A1r+v%C3%A9gleg+t%C3%B6r%C3%B6lheted+a+profilodat.");
    }

    let created = 0;
    let existing = 0;

    for (const property of activeProperties) {
        const { data: currentRequest } = await admin
            .from("tenant_exit_requests")
            .select("id,status")
            .eq("tenant_id", user.id)
            .eq("property_id", property.id)
            .eq("status", "PENDING")
            .maybeSingle();

        if (currentRequest) {
            existing += 1;
            continue;
        }

        const { error: requestError } = await admin
            .from("tenant_exit_requests")
            .insert({
                tenant_id: user.id,
                owner_id: property.owner_id,
                property_id: property.id,
                status: "PENDING",
            });

        if (requestError) {
            redirect(`/account?status=error&message=${encodeURIComponent(requestError.message)}`);
        }

        if (property.owner_email) {
            await sendEmail(renderTenantExitRequestEmail({
                ownerEmail: property.owner_email,
                ownerName: property.owner_name,
                tenantName: profile.full_name ?? null,
                tenantEmail: profile.email,
                propertyName: property.name,
                propertyAddress: property.address,
                openUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://rentapp.hu"}/owner/tenants`,
            }));
        }

        created += 1;
    }

    if (created === 0 && existing > 0) {
        redirect("/account?status=success&message=M%C3%A1r+van+folyamatban+l%C3%A9v%C5%91+kil%C3%A9p%C3%A9si+k%C3%A9relem.+V%C3%A1rd+meg+a+b%C3%A9rbead%C3%B3+j%C3%B3v%C3%A1hagy%C3%A1s%C3%A1t.");
    }

    redirect("/account?status=success&message=A+kil%C3%A9p%C3%A9si+k%C3%A9relem+elk%C3%BCldve+a+b%C3%A9rbead%C3%B3knak.");
}
