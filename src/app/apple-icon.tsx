import { ImageResponse } from "next/og";

export const size = {
    width: 180,
    height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background:
                        "radial-gradient(circle at 30% 20%, rgba(37,99,235,0.22), transparent 45%), linear-gradient(135deg, #0f172a 0%, #111f3b 54%, #072f2d 100%)",
                }}
            >
                <div
                    style={{
                        width: 132,
                        height: 132,
                        borderRadius: 44,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "linear-gradient(135deg, #1d4ed8 0%, #00a871 100%)",
                        boxShadow: "0 18px 42px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.25)",
                        color: "#f8fbff",
                        fontSize: 80,
                        fontWeight: 800,
                        lineHeight: 1,
                        fontFamily: "Arial, sans-serif",
                    }}
                >
                    R
                </div>
            </div>
        ),
        size,
    );
}
