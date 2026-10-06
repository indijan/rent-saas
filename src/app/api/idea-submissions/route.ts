import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestAuthContext } from "@/lib/auth/requestContext";

export async function POST(request: Request) {
    const formData = await request.formData();
    const featureName = String(formData.get("feature_name") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const submittedEmail = String(formData.get("email") || "").trim().toLowerCase();
    const submittedName = String(formData.get("full_name") || "").trim();
    const pageContext = String(formData.get("page_context") || "").trim();

    if (!featureName || !description) {
        return NextResponse.json({ ok: false, error: "A funkció megnevezése és a leírás kötelező." }, { status: 400 });
    }

    const { userId: requestUserId } = await getRequestAuthContext();
    const admin = createSupabaseAdminClient();

    let email = submittedEmail;
    let fullName = submittedName || null;
    let roleContext: "VISITOR" | "OWNER" | "TENANT" | "ADMIN" = "VISITOR";
    let source: "PUBLIC" | "SIGNED_IN" = "PUBLIC";
    let userId: string | null = null;

    if (requestUserId) {
        const { data: profile } = await admin
            .from("profiles")
            .select("id,email,full_name,role")
            .eq("id", requestUserId)
            .maybeSingle();

        if (profile?.email) {
            email = String(profile.email).toLowerCase();
            fullName = (profile.full_name as string | null) ?? fullName;
            roleContext = (profile.role as "OWNER" | "TENANT" | "ADMIN") ?? "VISITOR";
            source = "SIGNED_IN";
            userId = profile.id as string;
        }
    }

    if (!email) {
        return NextResponse.json({ ok: false, error: "Az e-mail-cím kötelező." }, { status: 400 });
    }

    const { error } = await admin
        .from("idea_submissions")
        .insert({
            user_id: userId,
            email,
            full_name: fullName,
            role_context: roleContext,
            source,
            page_context: pageContext || null,
            feature_name: featureName,
            description,
        });

    if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
