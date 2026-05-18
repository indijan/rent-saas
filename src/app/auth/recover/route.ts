import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function buildLoginErrorRedirect(request: NextRequest, message: string) {
    const url = new URL("/login", request.url);
    url.searchParams.set("status", "error");
    url.searchParams.set("message", message);
    return NextResponse.redirect(url);
}

function sanitizeNext(next: string | null) {
    if (!next || !next.startsWith("/")) {
        return "/account?status=success&message=Add+meg+az+új+jelszavad.";
    }
    return next;
}

export async function GET(request: NextRequest) {
    const tokenHash = request.nextUrl.searchParams.get("token_hash");
    const type = request.nextUrl.searchParams.get("type");
    const next = sanitizeNext(request.nextUrl.searchParams.get("next"));

    if (!tokenHash || !type) {
        return buildLoginErrorRedirect(request, "Hiányzik a jelszó-visszaállító token.");
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType,
    });

    if (error) {
        return buildLoginErrorRedirect(request, error.message);
    }

    return NextResponse.redirect(new URL(next, request.url));
}
