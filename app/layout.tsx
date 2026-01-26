// app/layout.tsx
import type { ReactNode } from "react";

export const metadata = {
  title: "Decisionary",
  description: "Tabletop simulation platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#f6f7fb",
          color: "#0b1220",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
        }}
      >
        {children}
      </body>
    </html>
  );
}
