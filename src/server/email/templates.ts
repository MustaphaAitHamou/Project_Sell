/**
 * Modèles d'emails transactionnels (HTML compatible clients mail + version texte).
 * Contenus en français ; aucun lien de tracking, aucune image distante.
 */
export type EmailTemplate = "verifyEmail" | "resetPassword" | "notification";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f6f5f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d1b19">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dedbd4;border-radius:14px">
<tr><td style="padding:20px 24px;border-bottom:1px solid #ebe9e4"><strong style="font-size:18px;color:#8a5300"><span style="color:#e5162f;letter-spacing:1px">TAMURT</span> Market</strong></td></tr>
<tr><td style="padding:24px"><h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>${bodyHtml}
${cta ? `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#f6a609;color:#2b1d00;border:2px solid #8a5300;text-decoration:none;padding:11px 20px;border-radius:12px;font-weight:700">${esc(cta.label)}</a></p><p style="font-size:12px;color:#5c5852">Si le bouton ne fonctionne pas, copiez ce lien : ${esc(cta.url)}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #ebe9e4;font-size:12px;color:#5c5852">Tamurt Market ne vous demandera jamais votre mot de passe, vos codes de vérification ou un paiement en dehors de la plateforme.</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (s: string) => `<p style="margin:0 0 12px;line-height:1.6">${esc(s)}</p>`;

export function renderEmail(template: EmailTemplate, data: Record<string, string>): RenderedEmail {
  switch (template) {
    case "verifyEmail": {
      const subject = "Confirmez votre adresse email";
      return {
        subject,
        html: layout(subject, p(`Bonjour ${data.name ?? ""},`) + p("Confirmez votre adresse pour activer votre compte Tamurt Market. Ce lien expire dans 24 heures."), { label: "Confirmer mon adresse", url: data.url! }),
        text: `Bonjour ${data.name ?? ""},\n\nConfirmez votre adresse pour activer votre compte Tamurt Market (lien valable 24 h) :\n${data.url}\n`,
      };
    }
    case "resetPassword": {
      const subject = "Réinitialisation de votre mot de passe";
      return {
        subject,
        html: layout(subject, p(`Bonjour ${data.name ?? ""},`) + p("Vous avez demandé à réinitialiser votre mot de passe. Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email."), { label: "Choisir un nouveau mot de passe", url: data.url! }),
        text: `Bonjour ${data.name ?? ""},\n\nRéinitialisez votre mot de passe (lien valable 1 h) :\n${data.url}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n`,
      };
    }
    case "notification": {
      const subject = data.title ?? "Notification";
      return {
        subject,
        html: layout(subject, p(data.body ?? ""), data.url ? { label: data.cta ?? "Voir le détail", url: data.url } : undefined),
        text: `${data.body ?? ""}\n${data.url ? `\n${data.url}\n` : ""}`,
      };
    }
  }
}
