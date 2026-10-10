/** The Outlook add-in's manifest, served from the app (see scripts/vercel-build.mjs). */
export function OutlookManifestLink({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <a href="/outlook/manifest.xml" download="clozer-outlook.xml" className={className}>
      {children}
    </a>
  );
}
