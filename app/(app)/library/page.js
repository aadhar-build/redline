import { redirect } from "next/navigation";
import { listDocuments } from "../../../lib/library/library.js";
import { supabaseConfig } from "../../../lib/supabase/config.js";
import { currentAccount } from "../../../lib/supabase/server.js";
import { formatSavedAt } from "./format";
import { LIBRARY_COPY } from "./library-copy";

// The Reviewer's saved documents, read with their own session: Row Level Security returns only this
// account's rows. Works without a model adapter, so it is the same on Vercel.
export const dynamic = "force-dynamic";

export const metadata = { title: "Library: Redline" };

export default async function LibraryPage() {
  const copy = LIBRARY_COPY.library;
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
  const documents = await listDocuments({ db });

  return (
    <section className="sheet app-page">
      <div className="wrap">
        <h1 className="section-title">{copy.pageTitle}</h1>
        <p className="section-lede">{copy.lede}</p>
        {documents.length === 0 ? (
          <div className="action-box library-empty" data-testid="library-empty">
            <p>{copy.empty}</p>
            <a className="cta" href="/review">{copy.emptyAction}</a>
          </div>
        ) : (
          <table className="library-index" data-testid="library">
            <thead>
              <tr>
                <th scope="col" className="ref-col">#</th>
                <th scope="col">{copy.columns.document}</th>
                <th scope="col">{copy.columns.saved}</th>
                <th scope="col" className="num-col">{copy.columns.flags}</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d, i) => (
                <tr key={d.id} data-testid="library-item">
                  <td className="ref-col">L-{documents.length - i}</td>
                  <td>
                    <a href={`/library/${d.id}`} data-testid="library-link">{d.title || copy.untitled}</a>
                  </td>
                  <td>{formatSavedAt(d.savedAt)}</td>
                  <td className="num-col">{copy.flagCount(d.flagCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
