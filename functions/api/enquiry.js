const ALLOWED_SERVICES = new Set([
  "Electrical",
  "Savant home control",
  "Lutron lighting control",
  "Audio visual",
  "TV and entertainment",
  "Networking",
  "Security",
]);
const MAX_BODY_BYTES = 16_000;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function cleanText(value, maxLength, singleLine = false) {
  if (typeof value !== "string") return "";
  const normalized = singleLine
    ? value.replace(/[\r\n]+/g, " ")
    : value.replace(/\r\n?/g, "\n");
  return normalized
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function validEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    return jsonResponse({ ok: false, error: "This enquiry could not be submitted." }, 403);
  }

  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: "Your message is too large. Please shorten it and try again." }, 413);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: "Your message is too large. Please shorten it and try again." }, 413);
  }

  let submission;
  try {
    submission = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ ok: false, error: "Please check the form and try again." }, 400);
  }

  if (!submission || typeof submission !== "object" || Array.isArray(submission)) {
    return jsonResponse({ ok: false, error: "Please check the form and try again." }, 400);
  }

  // Quietly discard likely automated submissions without sending them.
  if (cleanText(submission.website, 200, true)) return jsonResponse({ ok: true });

  const name = cleanText(submission.name, 120, true);
  const email = cleanText(submission.email, 254, true).toLowerCase();
  const message = cleanText(submission.message, 4_000);
  const services = Array.isArray(submission.services)
    ? [...new Set(submission.services.filter((service) => ALLOWED_SERVICES.has(service)))]
    : [];

  if (!name || !validEmail(email) || !message || services.length === 0) {
    return jsonResponse({ ok: false, error: "Please complete your name, email, project details and at least one service." }, 400);
  }

  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_EMAIL_API_TOKEN;
  const fromEmail = env.EVERYTHINGAV_FROM_EMAIL;
  const recipientEmail = env.EVERYTHINGAV_ENQUIRY_TO_EMAIL;
  if (!accountId || !apiToken || !fromEmail || !recipientEmail) {
    return jsonResponse({ ok: false, error: "Enquiry delivery is not connected yet. Your message has not been sent." }, 503);
  }

  const normalizedFrom = cleanText(fromEmail, 254, true).toLowerCase();
  const normalizedRecipient = cleanText(recipientEmail, 254, true).toLowerCase();
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !validEmail(normalizedFrom) || !validEmail(normalizedRecipient)) {
    console.error("Enquiry delivery configuration is invalid.");
    return jsonResponse({ ok: false, error: "Enquiry delivery is not available right now. Your message has not been sent." }, 503);
  }

  const emailText = [
    "New enquiry from the EverythingAV website",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Services: ${services.join(", ")}`,
    "",
    "Project details:",
    message,
  ].join("\n");

  try {
    const emailResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: normalizedRecipient,
          from: normalizedFrom,
          reply_to: email,
          subject: `Website enquiry from ${name}`,
          text: emailText,
        }),
      },
    );
    const result = await emailResponse.json().catch(() => null);
    const recipient = normalizedRecipient;
    const acceptedRecipients = [
      ...(Array.isArray(result?.result?.delivered) ? result.result.delivered : []),
      ...(Array.isArray(result?.result?.queued) ? result.result.queued : []),
    ].map((address) => String(address).toLowerCase());

    if (!emailResponse.ok || result?.success !== true || !acceptedRecipients.includes(recipient)) {
      console.error("Cloudflare Email Service did not accept an enquiry.", emailResponse.status);
      return jsonResponse({ ok: false, error: "We couldn’t send your enquiry just now. Your message has not been sent; please try again later." }, 502);
    }

    return jsonResponse({ ok: true });
  } catch {
    console.error("Cloudflare Email Service could not be reached.");
    return jsonResponse({ ok: false, error: "We couldn’t send your enquiry just now. Your message has not been sent; please try again later." }, 502);
  }
}
