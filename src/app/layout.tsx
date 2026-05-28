import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import MetaPixel from "@/components/MetaPixel";
import PublicCookieNotice from "@/components/PublicCookieNotice";
import SupportChatMount from "@/components/SupportChatMount";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rentapp",
  description: "Rentapp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
    return (
    <html lang="hu">
      <body
        className={`${spaceGrotesk.variable} ${fraunces.variable} antialiased`}
      >
        <MetaPixel />
        {children}
        <PublicCookieNotice />
        <SupportChatMount />
      </body>
    </html>
  );
}
