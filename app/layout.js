import { Archivo, Archivo_Narrow, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const ui = Archivo({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const label = Archivo_Narrow({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-label",
  display: "swap",
});
const text = Source_Serif_4({ subsets: ["latin"], variable: "--font-text", display: "swap" });

export const metadata = {
  title: "Redline: every flag shows the sentence it came from",
  description:
    "Redline reads a vendor agreement, commercial lease or client agreement before it is signed and marks what to push back on, with the exact sentence behind every point.",
};

// Direction contract. Emitted as an HTML comment so it survives the production build.
const CONTRACT = `
THESIS: A contract reviewed like a finished audit workpaper: every Risk flag ticked and cross-referenced to the sentence it came from. Refuses the legal-AI hero of gradient, screenshot and "Book a demo".
OWN-WORLD: Pale ruled workpaper sheet, graphite ink, red pencil for Don't sign as written, blue reference codes, a header block and a tick-mark legend. The Risk flags pane uses inspection-report structure: numbered Risk flags, action stamps, a Source sentence box, a fixed glyph key.
STORY: A Reviewer watches a sample contract become Risk flags grouped by Severity, checks each against its sentence, reads what Redline won't do, and tries it on a document.
FIRST VIEWPORT: Workpaper header block across the top; left, the headline, one line and the only action; right, the Risk flags pane with Risk flag 1 open on its Source sentence.
FORM: Audit Workpaper, candidate 1 of 7 (pick card), seed 20f69d25; Risk flags pane pinned by the product owner.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${ui.variable} ${label.variable} ${text.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets the demo's starting state before first paint, so ticks never erase and redraw on load. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&'IntersectionObserver' in window){document.documentElement.classList.add('motion')}",
          }}
        />
      </head>
      <body>
        <div hidden dangerouslySetInnerHTML={{ __html: `<!--${CONTRACT}-->` }} />
        {children}
      </body>
    </html>
  );
}
