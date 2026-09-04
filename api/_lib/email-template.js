// Shared branded HTML template for all transactional emails.
// Prefixed-underscore directory so Vercel does not turn this into a route.
//
// heading/bodyText/secondaryBodyText are inserted as raw HTML, not escaped
// — several callers deliberately build real <a href> links into bodyText
// (e.g. sendShortlistNotification's Calendly nudge). Every caller in
// api/email.js is responsible for escaping any database-sourced value (a
// candidate's name, a role or company name) with escapeHtml() from
// ./html.js BEFORE splicing it into the string it passes here — this
// function has no way to tell "text we authored" apart from "a value that
// came from a user-editable field" once they're already combined into one
// string.

const SITE_URL = 'https://beta.joinmellow.xyz'

export function renderEmailHtml({
  heading,
  bodyText,
  // Optional second paragraph, rendered below bodyText and above the CTA
  // buttons — for an email that needs a follow-on note after its main
  // message (e.g. an encouraging tip) without cramming it into one block.
  secondaryBodyText,
  ctaLabel,
  ctaUrl,
  // Optional second, side-by-side button (e.g. "We made a hire" /
  // "Still in progress") — styled as an outline button so it reads as the
  // secondary action without competing with the solid primary one.
  secondaryCtaLabel,
  secondaryCtaUrl,
  // Optional third button on its own row below the main CTA(s) — smaller
  // and lighter still, for a lower-emphasis follow-on action.
  extraCtaLabel,
  extraCtaUrl,
  illustration,
  illustrationWidth = 340,
  footerDomain = 'beta.joinmellow.xyz',
}) {
  const hasExtraCta = Boolean(extraCtaLabel && extraCtaUrl)
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;font-family:'Inter',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
            <tr>
              <td style="padding-bottom:32px;">
                <img src="${SITE_URL}/mellow_logofont_email_blue.png" alt="Mellow" height="28" style="display:block;height:28px;width:auto;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <img src="${SITE_URL}/${illustration}" alt="" width="${illustrationWidth}" style="display:block;width:${illustrationWidth}px;max-width:100%;height:auto;" />
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:12px;">
                <h1 style="margin:0;font-size:24px;line-height:1.3;color:#0a0a0a;font-weight:800;">${heading}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:28px;">
                <p style="margin:0;font-size:15px;line-height:1.6;color:#444444;">${bodyText}</p>
              </td>
            </tr>
            ${
              secondaryBodyText
                ? `<tr>
              <td style="padding-bottom:28px;">
                <p style="margin:0;font-size:15px;line-height:1.6;color:#444444;">${secondaryBodyText}</p>
              </td>
            </tr>`
                : ''
            }
            ${
              ctaLabel && ctaUrl
                ? `<tr>
              <td style="padding-bottom:${hasExtraCta ? 16 : 40}px;">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                  <td>
                    <a
                      href="${ctaUrl}"
                      style="display:inline-block;background:#005ef5;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:7px;"
                      >${ctaLabel}</a
                    >
                  </td>
                  ${
                    secondaryCtaLabel && secondaryCtaUrl
                      ? `<td style="padding-left:12px;">
                    <a
                      href="${secondaryCtaUrl}"
                      style="display:inline-block;background:#ffffff;color:#005ef5;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:7px;border:1.5px solid #005ef5;"
                      >${secondaryCtaLabel}</a
                    >
                  </td>`
                      : ''
                  }
                </tr></table>
              </td>
            </tr>`
                : ''
            }
            ${
              hasExtraCta
                ? `<tr>
              <td style="padding-bottom:40px;">
                <a
                  href="${extraCtaUrl}"
                  style="display:inline-block;background:#ffffff;color:#005ef5;text-decoration:none;font-weight:700;font-size:13px;padding:9px 18px;border-radius:7px;border:1.5px solid #005ef5;"
                  >${extraCtaLabel}</a
                >
              </td>
            </tr>`
                : ''
            }
            <tr>
              <td style="border-top:1px solid #eeeeee;padding-top:20px;">
                <p style="margin:0;font-size:12px;color:#999999;">Mellow &middot; ${footerDomain}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export { SITE_URL }
