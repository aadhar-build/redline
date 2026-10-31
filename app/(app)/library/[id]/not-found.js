import { LIBRARY_COPY } from "../library-copy";

export default function SavedReviewNotFound() {
  const copy = LIBRARY_COPY.saved;
  return (
    <section className="sheet app-page">
      <div className="wrap">
        <h1 className="section-title">{copy.notFoundTitle}</h1>
        <p className="section-lede" data-testid="saved-not-found">{copy.notFound}</p>
        <p className="back-link"><a href="/library">{copy.back}</a></p>
      </div>
    </section>
  );
}
