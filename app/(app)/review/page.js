import { isAnalysisAvailable } from "../../../lib/review/adapters/index.js";
import PasteForm from "./PasteForm";
import { COPY } from "./copy";

// Availability is read per request, so a build started without an adapter (Vercel) says so.
export const dynamic = "force-dynamic";

export const metadata = { title: "Upload or paste a contract: Redline" };

export default function ReviewPage() {
  const available = isAnalysisAvailable();
  return (
    <section className="sheet app-page">
      <div className="wrap">
        <h1 className="section-title">{COPY.pageTitle}</h1>
        <p className="section-lede">{COPY.pageLede}</p>
        {available ? (
          <PasteForm />
        ) : (
          <div className="action-box unavailable" role="status" data-testid="analysis-unavailable">
            <h2 className="box-title">{COPY.unavailableTitle}</h2>
            <p>{COPY.unavailableBody}</p>
          </div>
        )}
      </div>
    </section>
  );
}
