# Phase D — Discoverability and law

The cheapest phase to run and the most annoying to retrofit. Metadata and legal
pages are load-bearing at launch and nobody wants to write them on launch day.

Steps: **D1** SEO · **D2** images · **D3** legal · **D4** cookies

## D1 — SEO and metadata

- Title and description on every public route; templated titles for consistency.
- Canonical URLs. `metadataBase` set, or every relative URL resolves wrong.
- Open Graph and Twitter card metadata with a real image.
- `robots.txt` and `sitemap.xml` generated, and the sitemap contains the routes
  you actually want indexed — not the authenticated ones.
- Structured data (JSON-LD) where a rich result applies. Serialize with
  `JSON.stringify` of a static object, not string concatenation.
- Authenticated routes are `noindex`.

## D2 — Images

- Every image uses the framework's optimizing component with explicit dimensions;
  layout shift on the landing page is a Core Web Vitals penalty.
- External image domains explicitly allow-listed.
- Real `alt` text — decorative images get `alt=""`, meaningful ones get a
  description. "image" is not alt text.
- An OG image that exists and renders at the right aspect ratio.
- Favicon and app icons at the sizes the platforms actually request.

## D3 — Legal

- **Privacy policy** naming every third-party processor **by name** — the AI
  vendor, payment processor, email sender, database host, error monitor. "Third
  parties" is not disclosure, and a policy that denies a processor you use is a
  HIGH security finding (see Phase B).
- **Terms of service** with limitation of liability and an AS-IS warranty
  disclaimer, in the caps convention.
- **Data rights** — export and deletion endpoints that work, and deletion that
  actually cascades.
- **Retention periods** stated.
- **No false compliance claims.** Never state or imply HIPAA, SOC 2, PCI,
  ISO 27001, GDPR-certified, or a BAA the product does not hold. Describing real
  controls without a certification label is fine and is what you should do
  instead. This is legal liability, not a wording preference.
- **AI disclosure** where user content reaches a model, including whether it is
  used for training.

## D4 — Cookie consent

- Consent banner before any non-essential cookie is set — the order matters.
- Preferences persist and are re-openable *after* dismissal. A banner you can
  never bring back is a compliance gap; medcomplex added a footer link for this.
- Declining actually disables the tracking, rather than just hiding the banner.

## Gate

Mechanical: `gates/run-gate.sh`.

Judgment — Phase D does not pass until:

- [ ] Every public route has title + description + canonical
- [ ] Sitemap contains public routes only
- [ ] Privacy policy names every processor **by name** — cross-check against the
      actual dependency list and env vars, not from memory
- [ ] Zero compliance claims the product cannot substantiate
- [ ] Export and deletion endpoints exercised, not just present
- [ ] Cookie preferences re-openable after dismissal
- [ ] Zero CRITICAL, zero HIGH open
