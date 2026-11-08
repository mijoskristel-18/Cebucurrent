import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cebu Current — Good news, close to home",
  description: "A friendly local news desk for Cebu City, Cebu Province, and the communities in between.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
