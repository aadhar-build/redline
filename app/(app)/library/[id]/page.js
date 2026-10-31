import { notFound, redirect } from "next/navigation";
import { openSaved } from "../../../../lib/library/library.js";
import { getModelAdapter } from "../../../../lib/review/adapters/index.js";
import { runTokenFor } from "../../../../lib/review/local-guard.js";
import { supabaseConfig } from "../../../../lib/supabase/config.js";
import { currentAccount } from "../../../../lib/supabase/server.js";
import { formatSavedAt } from "../format";
import { LIBRARY_COPY } from "../library-copy";
import { currentRedLinesOrNull } from "../current-red-lines";
import RerunButton from "./RerunButton";
import SavedReview from "./SavedReview";

// A saved document and its review, reopened without calling the model (OQ17): openSaved takes no
// adapter. Every stored Source sentence is checked again against the stored text before it is shown.
// Another account's document is not found, because Row Level Security returns no row for it.
// When the Reviewer's Red lines differ from the list the review was checked against, the page says so
// and offers a re-run, which only runs when the Reviewer presses the button (ticket 15).
export const dynamic = "force-dynamic";

export const metadata = { title: "Saved review: Redline" };

export default async function SavedReviewPage({ params, searchParams }) {
  if (!supabaseConfig()) notFound();
  const { db, user } = await currentAccount();
  if (!user) redirect("/sign-in");
  const { id } = await params;
  // ?review=<id> opens an earlier review of this document, read-only (ticket 24 ruling 24).
  const requested = (await searchParams)?.review;
  const reviewId = typeof requested === "string" ? requested : null;
  const saved = await openSaved({ db, documentId: id, currentRedLines: await currentRedLinesOrNull(db), reviewId });
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
            {!saved.latest && (
              <p className="action-box" data-testid="earlier-review">
                {copy.earlier.note(formatSavedAt(saved.reviewedAt))} <a href={`/library/${document.id}`}>{copy.earlier.openLatest}</a>
              </p>
            )}
            {saved.latest && saved.olderRedLines && (
              <div className="action-box older-list" data-testid="older-list">
                <p>{copy.olderList}</p>
                {adapter ? (
                  <RerunButton key={saved.reviewedAt} documentId={document.id} runToken={runTokenFor(adapter)} />
                ) : (
                  <p className="field-hint" data-testid="rerun-off">{copy.rerunOff}</p>
                )}
              </div>
            )}
            <div className="saved-grid">
              <SavedReview
                key={saved.reviewId}
                review={review}
                documentId={document.id}
                askOff={adapter ? null : copy.askOff}
                runToken={runTokenFor(adapter)}
                canChange={Boolean(adapter)}
                readOnly={!saved.latest}
              />
            </div>
            {saved.history.length > 1 && (
              <section className="review-history" aria-labelledby="history-title" data-testid="review-history">
                <h2 className="pane-title" id="history-title">{copy.history.title}</h2>
                <table className="library-index">
                  <thead>
                    <tr>
                      <th scope="col">{copy.history.columns.reviewed}</th>
                      <th scope="col" className="num-col">{copy.history.columns.flags}</th>
                      <th scope="col"><span className="sr-only">{copy.history.columns.notes}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {saved.history.map((h) => (
                      <tr key={h.id} data-testid="history-row" aria-current={h.id === saved.reviewId ? "page" : undefined}>
                        <td>
                          {h.id === saved.reviewId ? (
                            <span data-testid="history-date">{formatSavedAt(h.reviewedAt)}</span>
                          ) : (
                            <a data-testid="history-date" href={h.latest ? `/library/${document.id}` : `/library/${document.id}?review=${h.id}`}>{formatSavedAt(h.reviewedAt)}</a>
                          )}
                        </td>
                        <td className="num-col" data-testid="history-flags">{h.flagCount}</td>
                        <td>
                          {h.latest && <span className="older-list-tag" data-testid="history-latest">{copy.history.latest}</span>}{" "}
                          {h.olderRedLines && <span className="older-list-tag" data-testid="history-older-list">{LIBRARY_COPY.library.olderList}</span>}{" "}
                          {h.id === saved.reviewId && <span className="older-list-tag" data-testid="history-open">{copy.history.open}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </>
        ) : (
          <p className="section-lede" role="status">{copy.noReview}</p>
        )}
      </div>
    </section>
  );
}
