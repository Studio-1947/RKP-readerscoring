import type { Metadata } from "next";
import { Google_Sans } from "next/font/google";
import "./globals.css";

const googleSans = Google_Sans({
  subsets: ["latin", "devanagari"],
  display: "swap",
  variable: "--font-google-sans",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  other: { google: "notranslate" },
  title: "Rajkamal Reader | पढ़िए, बढ़िए, जीतिए",
  description: "Hindi reading practice, rewards, and literary discovery by Rajkamal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hi" translate="no" className={`${googleSans.variable} notranslate`}>
      <body>{children}</body>
    </html>
  );
}
