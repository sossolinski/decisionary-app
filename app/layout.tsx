// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Decisionary",
  description: "Tabletop simulation platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var theme = localStorage.getItem("decisionary.theme") || "auto";
                  var language = localStorage.getItem("decisionary.language") || "en";
                  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                  var useDark = theme === "dark" || (theme === "auto" && prefersDark);
                  document.documentElement.classList.toggle("dark", useDark);
                  document.documentElement.lang = language === "pl" ? "pl" : "en";
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[12px] focus:bg-[var(--studio-surface2)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-[var(--studio-ring)]"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
