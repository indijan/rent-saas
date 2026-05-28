export const PUBLIC_COOKIE_NOTICE_KEY = "rentapp-public-cookie-notice-dismissed";
export const PUBLIC_COOKIE_EVENT = "rentapp:cookie-notice-dismissed";

export const PUBLIC_PATHS = new Set([
    "/",
    "/funkciok",
    "/hasznalati-dij",
    "/gyik",
    "/berbeadoi-regisztracio",
    "/otletlada",
    "/aszf",
]);

export function isPublicPath(pathname: string) {
    return PUBLIC_PATHS.has(pathname);
}
