import { redirect } from "next/navigation";
import { loadRedLines } from "../../../lib/library/red-lines.js";
import { DEFAULT_RED_LINES } from "../../../lib/review/red-lines.js";
import { supabaseConfig } from "../../../lib/supabase/config.js";
import { currentAccount } from "../../../lib/supabase/server.js";
import RedLinesEditor from "./RedLinesEditor";
import { RED_LINES_COPY } from "./red-lines-copy";

// The signed-in Reviewer's Red lines (ticket 12), read with their own session. Opening this page for
// the first time saves the four Default Red lines to the account. Never calls the model.
export const dynamic = "force-dynamic";

export const metadata = { title: "Red lines: Redline" };

export default async function RedLinesPage() {
  const copy = RED_LINES_COPY;
  if (!supabaseConfig()) {
    return (
      <section className="sheet app-page">
        <div className="wrap">
          <h1 className="section-title">{copy.pageTitle}</h1>
          <p className="section-lede" role="status">{copy.off}</p>
        </div>
      </section>
    );
  }
  const { db, user } = await currentAccount();
  if (!user) redirect("/sign-in");
  const list = await loadRedLines({ db });
  // The original names, for the line that says which Default Red line was removed.
  const defaultNames = DEFAULT_RED_LINES.map((r) => r.name);

  return (
    <section className="sheet app-page">
      <div className="wrap">
        <h1 className="section-title">{copy.pageTitle}</h1>
        <p className="section-lede">{copy.lede}</p>
        <RedLinesEditor initial={list} defaultNames={defaultNames} />
      </div>
    </section>
  );
}
