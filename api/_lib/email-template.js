// Shared branded HTML template for all transactional emails.
// Prefixed-underscore directory so Vercel does not turn this into a route.

const SITE_URL = 'https://beta.joinmellow.xyz'

export function renderEmailHtml({
  heading,
  bodyText,
  ctaLabel,
  ctaUrl,
  illustration,
  illustrationWidth = 340,
  footerDomain = 'beta.joinmellow.xyz',
}) {
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
            <tr>
              <td style="padding-bottom:40px;">
                <a
                  href="${ctaUrl}"
                  style="display:inline-block;background:#005ef5;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:7px;"
                  >${ctaLabel}</a
                >
              </td>
            </tr>
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
