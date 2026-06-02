import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();

    const url = new URL(request.url);
    const next = url.searchParams.get("next") || "/login";
    return NextResponse.redirect(new URL(next, url.origin));
}
