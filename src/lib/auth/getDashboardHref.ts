import { cookies } from "next/headers";

export async function getSignedInDashboardHref() {
    const cookieStore = await cookies();

    // Public marketing pages only need a cheap hint for the CTA label.
    // Avoid `auth.getUser()` here because that turns every navigation into
    // a network-backed auth check before the next page can render.
    const hasSupabaseAuthCookie = cookieStore
        .getAll()
        .some(({ name, value }) => name.startsWith("sb-") && name.includes("auth-token") && value.length > 0);

    return hasSupabaseAuthCookie ? "/dashboard" : null;
}
