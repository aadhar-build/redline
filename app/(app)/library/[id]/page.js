import { notFound, redirect } from "next/navigation";
import { openSaved } from "../../../../lib/library/library.js";
import { getModelAdapter } from "../../../../lib/review/adapters/index.js";
import { runTokenFor } from "../../../../lib/review/local-guard.js";
import { supabaseConfig } from "../../../../lib/supabase/config.js";
import { currentAccount } from "../../../../lib/supabase/server.js";
import ReviewResult from "../../review/ReviewResult";
import { formatSavedAt } from "../format";
import { LIBRARY_COPY } from "../library-copy";

// A saved document and its review, reopened without calling the model (OQ17): openSaved takes no
// adapter. Every stored Source sentence is checked again against the stored text before it is shown.
// Another account's document is not found, because Row Level Security returns no row for it.
export const dynamic = "force-dynamic";

export const metadata = { title: "Saved review: Redline" };

export default async function SavedReviewPage({ params }) {
  if (!supabaseConfig()) notFound();
  const { db, user } = await currentAccount();
  if (!user) redirect("/sign-in");
  const { id } = await params;
  const saved = await openSaved({ db, documentId: id });
  if (!saved) notFound();
  // Only to say whether questions are on, and to hand the CLI run token to the question box;
  // opening a saved review never calls the model.
  const adapter = getModelAdapter();

  const copy = LIBRARY_COPY.saved;
  const { document, review } = saved;
  return (
    <section className="sheet app-page">
      <div className="wrap">
        <p className="back-link"><a href="/library">{copy.back}</a></p>
        <h1 className="section-title" data-testid="saved-title">{document.title || LIBRARY_COPY.library.untitled}</h1>
        <dl className="saved-fields">
          <div>
            <dt>{copy.fields.source}</dt>
            <dd>{copy.sourceKinds[document.sourceKind] ?? document.sourceKind}</dd>
          </div>
          <div>
            <dt>{copy.fields.saved}</dt>
            <dd>{formatSavedAt(document.savedAt)}</dd>
          </div>
        </dl>
        {review ? (
          <>
            <p className="section-lede" data-testid="saved-note">{copy.note}</p>
            <div className="saved-grid">
              <ReviewResult
                review={review}
                documentId={document.id}
                askOff={adapter ? null : copy.askOff}
                runToken={runTokenFor(adapter)}
              />
            </div>
          </>
        ) : (
          <p className="section-lede" role="status">{copy.noReview}</p>
        )}
      </div>
    </section>
  );
}
