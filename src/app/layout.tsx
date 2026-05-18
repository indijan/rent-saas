import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import AuthRecoveryListener from "@/components/AuthRecoveryListener";
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
        <AuthRecoveryListener />
        {children}
      </body>
    </html>
  );
}
