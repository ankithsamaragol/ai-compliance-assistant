// A compact inline replacement for the old full-width data-notice banner that used to repeat on
// every page with a provider dropdown (Evidence, Chat, Documents, Vendors). The disclosure itself
// stays — this app's whole positioning is honesty about third-party data processing — but it no
// longer has to dominate the page every time; the full text is one hover away via the native
// title tooltip, and a one-time explanation lives in the signup form instead.
export default function ProviderNotice({ provider }) {
  if (!provider?.dataNotice) return null;
  return (
    <span
      className={`provider-badge ${provider.local ? 'provider-badge-local' : 'provider-badge-cloud'}`}
      title={provider.dataNotice}
    >
      {provider.local ? '🔒 Local' : '☁️ Cloud'}
    </span>
  );
}
