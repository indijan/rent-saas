import { cookies } from "next/headers";
import PublicCookieNotice from "@/components/PublicCookieNotice";
import { PUBLIC_COOKIE_NOTICE_KEY } from "@/lib/publicShell";

export default async function PublicPageEnhancements() {
    const cookieStore = await cookies();
    const hasConsent = cookieStore.get(PUBLIC_COOKIE_NOTICE_KEY)?.value === "1";
    const PublicAnalyticsMount = hasConsent
        ? (await import("@/components/PublicAnalyticsMount")).default
        : null;

    return (
        <>
            <PublicCookieNotice initialDismissed={hasConsent} />
            {PublicAnalyticsMount ? <PublicAnalyticsMount initialConsent={hasConsent} /> : null}
        </>
    );
}
