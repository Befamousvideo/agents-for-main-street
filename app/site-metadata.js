// Metadata helpers. CJS so Next and the node check script can load this file.
// Next.js App Router: assign the return value to metadata.verification so
// metadata.verification.google emits <meta name="google-site-verification" content="...">
// only when NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION is set. No DNS record.
function googleVerification(env) {
  const v = (env || process.env).NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
  return v ? { google: v } : undefined;
}

function googleVerificationMeta(env) {
  const verification = googleVerification(env);
  if (!verification) return null;
  return { name: "google-site-verification", content: verification.google };
}

module.exports = { googleVerification, googleVerificationMeta };
