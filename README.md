# EverythingAV

Multi-page website for EverythingAV, covering electrical, AV and home automation services.

## Cloudflare Pages

This is a plain HTML/CSS/JavaScript site with a Pages Function for the contact form. Connect the GitHub repository to Cloudflare Pages with:

- Production branch: `main`
- Build command: `exit 0`
- Build output directory: `.`
- Root directory: repository root

Set these Pages variables for the production environment before enabling enquiry delivery:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_EMAIL_API_TOKEN` (secret with Email Sending permission)
- `EVERYTHINGAV_FROM_EMAIL` (an address on a sender domain onboarded to Cloudflare Email Service)
- `EVERYTHINGAV_ENQUIRY_TO_EMAIL` (secret recipient address)

The form will report that it has not sent the enquiry until all settings are present and Cloudflare accepts the message.
