/**
 * Lead capture backend for the A2L Refrigerant Reference site.
 *
 * This is NOT deployed automatically — Apps Script projects are deployed
 * through a Google account OAuth click-through that can't be scripted from
 * outside a browser. See README.md in this folder for the one-time manual
 * setup. This file is the source of truth; paste it into the Apps Script
 * editor whenever it changes.
 *
 * Design notes:
 * - Turnstile verification happens HERE, server-side, using
 *   PropertiesService (never hardcode the secret key in this file — it
 *   would end up committed to git).
 * - The client sends the POST body with Content-Type: text/plain, not
 *   application/json. That's deliberate: it keeps the request a CORS
 *   "simple request" so the browser doesn't send a preflight OPTIONS
 *   request, which Apps Script Web Apps don't handle. The body is still
 *   parsed as JSON on this end regardless of the declared content type.
 * - A honeypot field ("website") is accepted silently (no sheet row, no
 *   error) rather than rejected loudly, so bots don't learn to adapt.
 */

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);

    if (params.website) {
      // Honeypot tripped — pretend success, write nothing.
      return jsonResponse({ ok: true });
    }

    var turnstileToken = params.turnstileToken;
    if (!turnstileToken) {
      return jsonResponse({ ok: false, error: "missing_turnstile_token" });
    }

    var secret = PropertiesService.getScriptProperties().getProperty("TURNSTILE_SECRET_KEY");
    if (!secret) {
      return jsonResponse({ ok: false, error: "server_not_configured" });
    }

    var verifyResponse = UrlFetchApp.fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "post",
        payload: { secret: secret, response: turnstileToken },
        muteHttpExceptions: true,
      },
    );
    var verifyResult = JSON.parse(verifyResponse.getContentText());
    if (!verifyResult.success) {
      return jsonResponse({ ok: false, error: "turnstile_failed" });
    }

    var sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Leads") ||
      SpreadsheetApp.getActiveSpreadsheet().insertSheet("Leads");

    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "submitted_at",
        "email",
        "zip",
        "equipment_model",
        "quoted_price",
        "message",
        "page_url",
        "user_agent",
      ]);
    }

    sheet.appendRow([
      new Date().toISOString(),
      String(params.email || ""),
      String(params.zip || ""),
      String(params.equipmentModel || ""),
      String(params.quotedPrice || ""),
      String(params.message || ""),
      String(params.pageUrl || ""),
      String(params.userAgent || ""),
    ]);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: "server_error", detail: String(err) });
  }
}

function jsonResponse(obj) {
  // Apps Script Web Apps always respond 200 at the transport level --
  // there's no API to set an arbitrary HTTP status code. The client checks
  // the `ok` field in the JSON body instead.
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
