import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { siteConfig } from "@/config/site";
import { seoConfig } from "@/config/seo";
import { DocumentThemeScope } from "@/components/theme/DocumentThemeScope.client";
import { adminThemeInitScript } from "@/lib/admin-theme-script";
import { criticalCss, cssLoadGuardScript } from "@/lib/critical-css";
import { assertProductionSecrets } from "@/lib/env/env.server";
import { clerkConfigured, clerkLoginEnabled, clerkRoutes } from "@/lib/auth/clerk";
import { holisticClerkAppearance } from "@/lib/auth/clerk-appearance";
import { getClerkLocalization } from "@/lib/auth/clerk-localization";
import { resolveAppLocale } from "@/i18n/config";
import { routes } from "@/config/routes";
import { readPanelPreferences } from "@/lib/ui/panel-preferences.server";
import "./globals.css";

/** Dashboard / auth UI. */
const plusJakarta = localFont({
  src: "./fonts/PlusJakartaSans-variable.ttf",
  display: "swap",
  variable: "--font-jakarta",
  weight: "400 700",
  fallback: [
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
  adjustFontFallback: "Arial",
});

/** Landing Techlo Lite → Holistic. */
const sora = localFont({
  src: "./fonts/Sora-variable.ttf",
  display: "swap",
  variable: "--font-sora",
  weight: "400 700",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
  adjustFontFallback: "Arial",
});

/** Panel (sistema visual v3): texto y números. */
const geist = localFont({
  src: "./fonts/Geist-variable.woff2",
  display: "swap",
  variable: "--font-geist",
  weight: "100 900",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
  adjustFontFallback: "Arial",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-variable.woff2",
  display: "swap",
  variable: "--font-geist-mono",
  weight: "100 900",
  // Solo se usa en cifras: no hace falta precargarla.
  preload: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
  adjustFontFallback: false,
});

/** Acento tipográfico auth (mockup script). */
const caveat = localFont({
  src: "./fonts/Caveat-variable.ttf",
  display: "swap",
  variable: "--font-caveat",
  weight: "500 700",
  fallback: ["cursive"],
  adjustFontFallback: "Arial",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fcfbf9",
};

export const metadata: Metadata = {
  metadataBase: new URL(seoConfig.siteUrl),
  title: siteConfig.name,
  description: siteConfig.description,
  openGraph: {
    type: "website",
    siteName: seoConfig.siteName,
    locale: "es_PE",
    images: [{ url: seoConfig.ogImagePath, width: 1600, height: 1000 }],
  },
  applicationName: "Ads Holistic",
  appleWebApp: {
    capable: true,
    title: "Ads Holistic",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/apple-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  assertProductionSecrets();

  const locale = resolveAppLocale(await getLocale());
  const panel = await readPanelPreferences();
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const clerkEnabled = clerkConfigured() && clerkLoginEnabled();

  const body = (
    <NextIntlClientProvider>
      <DocumentThemeScope />
      {children}
    </NextIntlClientProvider>
  );

  return (
    <html
      lang={locale}
      className={`${plusJakarta.variable} ${sora.variable} ${caveat.variable} ${geist.variable} ${geistMono.variable} light h-full antialiased`}
      data-ui-theme={panel.theme}
      data-ui-contrast={panel.contrast === "alto" ? "alto" : undefined}
      suppressHydrationWarning
    >
      <head>
        <style
          id="holistic-critical-css"
          dangerouslySetInnerHTML={{ __html: criticalCss }}
        />
        <script dangerouslySetInnerHTML={{ __html: adminThemeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: cssLoadGuardScript }} />
      </head>
      <body
        className={`${plusJakarta.className} min-h-full overflow-x-hidden bg-[var(--background)] text-[var(--foreground)] antialiased`}
      >
        {clerkEnabled && publishableKey ? (
          <ClerkProvider
            publishableKey={publishableKey}
            localization={getClerkLocalization()}
            appearance={holisticClerkAppearance}
            signInUrl={clerkRoutes.signIn}
            signUpUrl={clerkRoutes.signUp}
            signInFallbackRedirectUrl={clerkRoutes.complete}
            signUpFallbackRedirectUrl={clerkRoutes.complete}
            afterSignOutUrl={routes.login}
            allowedRedirectOrigins={[
              "https://www.adsholistic.com",
              "https://adsholistic.com",
              "http://localhost:3000",
            ]}
          >
            {body}
          </ClerkProvider>
        ) : (
          body
        )}
      </body>
    </html>
  );
}
