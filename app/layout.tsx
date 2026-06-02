import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/app/components/Nav";
import ToastProvider from '@/app/components/ui/ToastProvider';
import { createServerSupabaseClient } from '@/lib/supabase-server';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wooli",
  description: "Personal wellness dashboard",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const OWNER_EMAIL = 'woolitravel@gmail.com'

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const fullAccess = !user || user.email === OWNER_EMAIL

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav fullAccess={fullAccess} />
        <main className="flex-1 flex flex-col pb-16 md:pb-0">
          <ToastProvider>
            {children}
          </ToastProvider>
        </main>
      </body>
    </html>
  );
}
