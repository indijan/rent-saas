import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createProxyIdentity, PROXY_IDENTITY_HEADER } from "@/lib/auth/proxyIdentity";

function isRecoverableAuthRefreshError(error: unknown) {
    if (!error || typeof error !== "object") return false;
    const maybeError = error as { code?: string; message?: string; name?: string; status?: number };
    const message = String(maybeError.message || "").toLowerCase();
    return maybeError.name === "AuthSessionMissingError"
        || maybeError.code === "refresh_token_not_found"
        || maybeError.code === "invalid_refresh_token"
        || message.includes("invalid refresh token")
        || message.includes("refresh token not found")
        || message.includes("jwt expired");
}

function syncRequestCookieHeader(request: NextRequest, requestHeaders: Headers) {
    const cookieHeader = request.cookies.toString();
    if (cookieHeader) requestHeaders.set("cookie", cookieHeader);
    else requestHeaders.delete("cookie");
}

function clearSupabaseCookies(request: NextRequest, response: NextResponse, requestHeaders: Headers) {
    request.cookies.getAll().forEach(({ name }) => {
        if (!name.startsWith("sb-")) return;
        request.cookies.delete(name);
        response.cookies.delete(name);
    });
    syncRequestCookieHeader(request, requestHeaders);
}

function copyResponseCookies(source: NextResponse, destination: NextResponse) {
    source.cookies.getAll().forEach(({ name, value, ...options }) => {
        destination.cookies.set(name, value, options);
    });
}

export async function updateSession(request: NextRequest) {
    const requestHeaders = new Headers(request.headers);
    // Never accept an identity assertion supplied by the browser.
    requestHeaders.delete(PROXY_IDENTITY_HEADER);

    if (!request.cookies.getAll().some(({ name }) => name.startsWith("sb-"))) {
        return NextResponse.next({ request: { headers: requestHeaders } });
    }

    let response = NextResponse.next({ request: { headers: requestHeaders } });

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

                    syncRequestCookieHeader(request, requestHeaders);
                    response = NextResponse.next({ request: { headers: requestHeaders } });

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
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error && isRecoverableAuthRefreshError(error)) {
            clearSupabaseCookies(request, response, requestHeaders);
            return response;
        }

        if (error) {
            console.error("Supabase session refresh failed in proxy", error);
        }

        if (user) {
            const identity = createProxyIdentity(user.id);
            if (identity) {
                requestHeaders.set(PROXY_IDENTITY_HEADER, identity);
                const authenticatedResponse = NextResponse.next({ request: { headers: requestHeaders } });
                copyResponseCookies(response, authenticatedResponse);
                response = authenticatedResponse;
            }
        }
    } catch (error) {
        if (isRecoverableAuthRefreshError(error)) {
            clearSupabaseCookies(request, response, requestHeaders);
            return response;
        }

        console.error("Supabase session refresh failed in proxy", error);
    }

    return response;
}
