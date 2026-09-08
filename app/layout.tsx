import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  other: { google: "notranslate" },
  title: "Rajkamal Reader | पढ़िए, बढ़िए, जीतिए",
  description: "Hindi reading practice, rewards, and literary discovery by Rajkamal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hi" translate="no" className="notranslate">
      <body>{children}</body>
    </html>
  );
}
