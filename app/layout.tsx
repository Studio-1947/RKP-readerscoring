import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rajkamal Reader | पढ़िए, बढ़िए, जीतिए",
  description: "Hindi reading practice, rewards, and literary discovery by Rajkamal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hi">
      <body>{children}</body>
    </html>
  );
}
