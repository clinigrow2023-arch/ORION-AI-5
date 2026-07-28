import nodemailer from "nodemailer";
import {
  emailAccessLabel,
  emailFooter,
  existingUserEmail,
  newUserEmail,
  pickEmail,
  renewalThankYouEmail,
  subscriptionExpiredEmail,
  type EmailContent,
  type EmailTheme,
} from "./email-copy.js";
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from "./locale.js";

// Configuração do Gmail
const GMAIL_USER = (process.env.GMAIL_USER || "").trim();
// App passwords are 16 chars; strip spaces from display format "xxxx xxxx xxxx xxxx"
const GMAIL_PASS = (process.env.GMAIL_PASS || "").replace(/\s+/g, "");
const SITE_URL = process.env.SITE_URL || "https://your-site.vercel.app";

// Criar transporter do Gmail
const createTransporter = () => {
  if (!GMAIL_USER || !GMAIL_PASS) {
    console.warn("Gmail credentials not configured, email sending disabled");
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
};

const HEADER_GRADIENTS: Record<EmailTheme, string> = {
  brand: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  success: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
  danger: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
};

/** Escapa dados dinâmicos (nome, e-mail, senha) antes de injetar no HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function styles(theme: EmailTheme): string {
  return `
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: ${HEADER_GRADIENTS[theme]};
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .credentials {
            background: white;
            border: 2px solid #667eea;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .credential-item {
            margin: 10px 0;
          }
          .label {
            font-weight: bold;
            color: #667eea;
          }
          .value {
            font-family: monospace;
            background: #f0f0f0;
            padding: 5px 10px;
            border-radius: 4px;
            display: inline-block;
            margin-left: 10px;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
            text-align: center;
          }`;
}

/**
 * Renderiza um `EmailContent` nas duas partes exigidas pelos clientes de
 * e-mail (HTML e texto puro) a partir da mesma lista de blocos.
 */
function render(
  content: EmailContent,
  locale: Locale,
  name: string,
  loginUrl: string
): { html: string; text: string } {
  const footer = emailFooter(locale);
  const year = new Date().getFullYear();
  const safeName = escapeHtml(name);

  const htmlBlocks: string[] = [];
  const textBlocks: string[] = [];

  for (const block of content.blocks) {
    switch (block.kind) {
      case "greeting": {
        htmlBlocks.push(
          `<p>${escapeHtml(block.template).replace(
            "{name}",
            `<strong>${safeName}</strong>`
          )}</p>`
        );
        textBlocks.push(block.template.replace("{name}", name));
        break;
      }
      case "paragraph": {
        htmlBlocks.push(`<p>${escapeHtml(block.text)}</p>`);
        textBlocks.push(block.text);
        break;
      }
      case "notice": {
        htmlBlocks.push(
          `<p><strong>${escapeHtml(block.label)}</strong> ${escapeHtml(
            block.text
          )}</p>`
        );
        textBlocks.push(`${block.label.toUpperCase()} ${block.text}`);
        break;
      }
      case "warning": {
        htmlBlocks.push(
          `<div class="warning"><p><strong>${escapeHtml(
            block.label
          )}</strong> ${escapeHtml(block.text)}</p></div>`
        );
        textBlocks.push(`${block.label.toUpperCase()} ${block.text}`);
        break;
      }
      case "credentials": {
        const items = block.items
          .map(
            (item) =>
              `<div class="credential-item"><span class="label">${escapeHtml(
                item.label
              )}</span><span class="value">${escapeHtml(
                item.value
              )}</span></div>`
          )
          .join("\n            ");

        htmlBlocks.push(
          `<div class="credentials">
            <h3 style="margin-top: 0; color: #667eea;">${escapeHtml(
              block.title
            )}</h3>
            ${items}
          </div>`
        );
        textBlocks.push(
          [
            block.title,
            ...block.items.map((item) => `${item.label} ${item.value}`),
          ].join("\n")
        );
        break;
      }
      case "button": {
        htmlBlocks.push(
          `<div style="text-align: center;"><a href="${escapeHtml(
            loginUrl
          )}" class="button">${escapeHtml(
            block.label
          )}</a></div>`
        );
        textBlocks.push(`${emailAccessLabel(locale)}: ${loginUrl}`);
        break;
      }
      default: {
        // Garante em tempo de compilação que todo bloco novo seja renderizado.
        const exhaustive: never = block;
        throw new Error(`Unhandled email block: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(content.heading)}</title>
  <style>${styles(content.theme)}
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(content.heading)}</h1>
  </div>
  <div class="content">
    ${htmlBlocks.join("\n\n    ")}

    <div class="footer">
      <p>${escapeHtml(footer.automated)}</p>
      <p>&copy; ${year} ${escapeHtml(footer.rights)}</p>
    </div>
  </div>
</body>
</html>`;

  const text = [
    content.heading,
    "",
    ...textBlocks.flatMap((block) => [block, ""]),
    footer.automated,
  ]
    .join("\n")
    .trim();

  return { html, text };
}

/** Envia o e-mail já renderizado, tratando ausência de credenciais SMTP. */
async function deliver(
  to: string,
  content: EmailContent,
  locale: Locale,
  name: string,
  logLabel: string
): Promise<boolean> {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("Email transporter not available, skipping email send");
    return false;
  }

  const loginUrl = `${SITE_URL}/#login`;
  const { html, text } = render(content, locale, name, loginUrl);

  try {
    const info = await transporter.sendMail({
      from: `"Orion AI" <${GMAIL_USER}>`,
      to,
      subject: content.subject,
      html,
      text,
    });
    console.log(`${logLabel} sent successfully:`, {
      email: to,
      locale,
      messageId: info.messageId,
    });
    return true;
  } catch (error: any) {
    console.error(`Error sending ${logLabel}:`, {
      email: to,
      locale,
      error: error.message,
    });
    return false;
  }
}

/**
 * Sends email to new user with access credentials
 */
export async function sendNewUserEmail(
  email: string,
  name: string,
  password: string,
  locale: Locale | string | null = DEFAULT_LOCALE
): Promise<boolean> {
  const resolved = normalizeLocale(locale);
  return deliver(
    email,
    pickEmail(newUserEmail, resolved, name, email, password),
    resolved,
    name,
    "New user email"
  );
}

/**
 * Sends email to existing user informing that access has been granted
 */
export async function sendExistingUserEmail(
  email: string,
  name: string,
  locale: Locale | string | null = DEFAULT_LOCALE
): Promise<boolean> {
  const resolved = normalizeLocale(locale);
  return deliver(
    email,
    pickEmail(existingUserEmail, resolved, name),
    resolved,
    name,
    "Existing user email"
  );
}

/**
 * Sends thank-you email when subscription is renewed
 */
export async function sendRenewalThankYouEmail(
  email: string,
  name: string,
  locale: Locale | string | null = DEFAULT_LOCALE
): Promise<boolean> {
  const resolved = normalizeLocale(locale);
  return deliver(
    email,
    pickEmail(renewalThankYouEmail, resolved, name),
    resolved,
    name,
    "Renewal thank-you email"
  );
}

/**
 * Sends email to user informing that subscription has expired
 */
export async function sendSubscriptionExpiredEmail(
  email: string,
  name: string,
  locale: Locale | string | null = DEFAULT_LOCALE
): Promise<boolean> {
  const resolved = normalizeLocale(locale);
  return deliver(
    email,
    pickEmail(subscriptionExpiredEmail, resolved, name),
    resolved,
    name,
    "Subscription expired email"
  );
}
