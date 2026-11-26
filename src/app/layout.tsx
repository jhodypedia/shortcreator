import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AppShell } from "@/components/app-shell";
import { MotionProvider } from "@/components/motion-provider";
import { PageTransition } from "@/components/block-motion";
import { StudioIntro } from "@/components/studio-intro";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Short Generator — Studio Produksi Serial Shorts",
  description:
    "Buat serial YouTube Shorts, TikTok, dan Reels 3D voxel dari nol secara bulk dan bersambung.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0c0e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`dark ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <MotionProvider>
          <StudioIntro />
          <AppShell>
            <PageTransition>{children}</PageTransition>
          </AppShell>
        </MotionProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "!sonner-toast !bg-card !text-card-foreground",
              title: "!text-[13px] !font-semibold",
              description: "!text-muted-foreground !text-xs",
              success: "!border-primary",
              error: "!border-destructive",
              warning: "!border-chart-3",
              info: "!border-chart-2",
            },
          }}
        />
      </body>
    </html>
  );
}
