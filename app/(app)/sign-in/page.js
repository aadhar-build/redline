import { redirect } from "next/navigation";
import { supabaseConfig } from "../../../lib/supabase/config.js";
import { currentAccount } from "../../../lib/supabase/server.js";
import { LIBRARY_COPY } from "../library/library-copy";
import SignInForm from "./SignInForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in: Redline" };

export default async function SignInPage({ searchParams }) {
  const copy = LIBRARY_COPY.signIn;
  const accountsOn = supabaseConfig() !== null;
  if (accountsOn) {
    const { user } = await currentAccount();
    if (user) redirect("/library");
  }
  const params = await searchParams;
  return (
    <section className="sheet app-page">
      <div className="wrap">
        <h1 className="section-title">{copy.pageTitle}</h1>
        {accountsOn ? (
          <>
            <p className="section-lede">{copy.lede}</p>
            {params?.link === "failed" && (
              <p className="form-error sign-in-error" role="alert" data-testid="link-failed">{copy.errors.link}</p>
            )}
            <SignInForm />
          </>
        ) : (
          <p className="section-lede" role="status">{copy.off}</p>
        )}
      </div>
    </section>
  );
}
