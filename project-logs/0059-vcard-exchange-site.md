# 0059 vCard exchange site

- Added `/vcard` as a digital business card page for Seo Daewoong at KIDA.
- Added iPhone QR generation as a `.vcf` URL and Android QR generation as a direct `MECARD:` payload.
- Added Turso-backed scan and card-exchange persistence with lazy table creation.
- Added API routes for QR SVG, vCard download, and inbound exchange form submissions.
