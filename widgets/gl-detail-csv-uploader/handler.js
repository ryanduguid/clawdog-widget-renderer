// handler.js — Submission handler for the GL Detail CSV uploader widget.
//
// Receives form values (object with entityId, periodUri, glDetailCsv File, dryRun bool)
// and POSTs them as multipart/form-data to the calc-api endpoint named in widget.json.
//
// Output contract:
//   - Returns a Promise<object> with { ok, status, body } or { ok: false, error }
//   - On success: posts a postMessage to window.parent with the response shape
//     (for iframe-embedded use; host shells receive the result via the postMessage protocol)
//
// Lessons honoured:
//   #36 — handler is widget-specific (knows GL Detail field shape); renderer stays generic
//   #38 — response body keeps its parsed JSON or decoded text representation

const POST_MESSAGE_TYPE = 'cw-widget-response';

function getParentRecipient() {
  try {
    const parent = window.parent;
    if (!parent || parent === window) return null;
    const referrer = new URL(document.referrer);
    if (referrer.protocol !== 'http:' && referrer.protocol !== 'https:') return null;
    return { parent, origin: referrer.origin };
  } catch {
    // An unavailable referrer disables host notifications, not submission.
    return null;
  }
}

async function handleSubmit(values, widgetManifest) {
  if (!widgetManifest || !widgetManifest.calc_api_url) {
    return { ok: false, error: 'widget.json missing calc_api_url' };
  }

  const recipient = getParentRecipient();
  const form = new FormData();
  if (values.entityId) form.set('entity_id', values.entityId);
  if (values.periodUri) form.set('period_uri', values.periodUri);
  if (values.glDetailCsv instanceof File) form.set('gl_detail_csv', values.glDetailCsv);
  if (typeof values.dryRun === 'boolean') form.set('dry_run', values.dryRun ? 'true' : 'false');

  try {
    const resp = await fetch(widgetManifest.calc_api_url, {
      method: 'POST',
      body: form,
    });
    const text = await resp.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }

    const result = { ok: resp.ok, status: resp.status, body };

    // Notify host shell (if iframe-embedded) of the response
    if (recipient) {
      try {
        recipient.parent.postMessage(
          { type: POST_MESSAGE_TYPE, widget: widgetManifest.name, result },
          recipient.origin
        );
      } catch {
        // postMessage failure is non-fatal
      }
    }

    return result;
  } catch (err) {
    const errResult = { ok: false, error: String(err && err.message ? err.message : err) };
    if (recipient) {
      try {
        recipient.parent.postMessage(
          { type: POST_MESSAGE_TYPE, widget: widgetManifest.name, result: errResult },
          recipient.origin
        );
      } catch {
        // postMessage failure is non-fatal
      }
    }
    return errResult;
  }
}

export { handleSubmit, POST_MESSAGE_TYPE };
