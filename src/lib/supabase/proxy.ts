import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isRecoverableAuthRefreshError(error: unknown) {
    if (!error || typeof error !== "object") return false;
    const maybeError = error as { code?: string; message?: string; status?: number };
    const message = String(maybeError.message || "").toLowerCase();
    return maybeError.code === "refresh_token_not_found"
        || maybeError.code === "invalid_refresh_token"
        || message.includes("invalid refresh token")
        || message.includes("refresh token not found")
        || message.includes("jwt expired");
}

function clearSupabaseCookies(request: NextRequest, response: NextResponse) {
    request.cookies.getAll().forEach(({ name }) => {
        if (!name.startsWith("sb-")) return;
        request.cookies.delete(name);
        response.cookies.delete(name);
    });
}

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => {
                        request.cookies.set(name, value);
                    });

                    response = NextResponse.next({
                        request,
                    });

                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    // Force Supabase to refresh the auth session and mirror updated cookies
    // back onto the current request/response pair before protected routes run.
    try {
        await supabase.auth.getUser();
    } catch (error) {
        if (isRecoverableAuthRefreshError(error)) {
            clearSupabaseCookies(request, response);
            return response;
        }

        console.error("Supabase session refresh failed in proxy", error);
    }

    return response;
}
