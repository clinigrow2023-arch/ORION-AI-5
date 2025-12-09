import nodemailer from "nodemailer";

// Configuração do Gmail
const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_PASS = process.env.GMAIL_PASS || ""; // App Password do Gmail
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
  });
};

/**
 * Envia email para novo usuário com credenciais de acesso
 */
export async function sendNewUserEmail(
  email: string,
  name: string,
  password: string
): Promise<boolean> {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("Email transporter not available, skipping email send");
    return false;
  }

  const loginUrl = `${SITE_URL}/#login`;

  const mailOptions = {
    from: `"Orion AI" <${GMAIL_USER}>`,
    to: email,
    subject: "Bem-vindo ao Orion AI - Suas credenciais de acesso",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Bem-vindo ao Orion AI!</h1>
        </div>
        <div class="content">
          <p>Olá <strong>${name}</strong>,</p>
          
          <p>Sua compra foi confirmada com sucesso! Sua conta foi criada e está ativa.</p>
          
          <div class="credentials">
            <h3 style="margin-top: 0; color: #667eea;">Suas credenciais de acesso:</h3>
            <div class="credential-item">
              <span class="label">Email:</span>
              <span class="value">${email}</span>
            </div>
            <div class="credential-item">
              <span class="label">Senha temporária:</span>
              <span class="value">${password}</span>
            </div>
          </div>
          
          <p><strong>Importante:</strong> Por segurança, você precisará alterar esta senha no primeiro login.</p>
          
          <div style="text-align: center;">
            <a href="${loginUrl}" class="button">Acessar Orion AI</a>
          </div>
          
          <p>Se você tiver alguma dúvida ou precisar de ajuda, não hesite em entrar em contato conosco.</p>
          
          <div class="footer">
            <p>Este é um email automático, por favor não responda.</p>
            <p>&copy; ${new Date().getFullYear()} Orion AI. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Bem-vindo ao Orion AI!

Olá ${name},

Sua compra foi confirmada com sucesso! Sua conta foi criada e está ativa.

Suas credenciais de acesso:
Email: ${email}
Senha temporária: ${password}

IMPORTANTE: Por segurança, você precisará alterar esta senha no primeiro login.

Acesse: ${loginUrl}

Se você tiver alguma dúvida ou precisar de ajuda, não hesite em entrar em contato conosco.

Este é um email automático, por favor não responda.
    `.trim(),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully to new user:", {
      email,
      messageId: info.messageId,
    });
    return true;
  } catch (error: any) {
    console.error("Error sending email to new user:", {
      email,
      error: error.message,
    });
    return false;
  }
}

/**
 * Envia email para usuário existente informando que acesso foi liberado
 */
export async function sendExistingUserEmail(
  email: string,
  name: string
): Promise<boolean> {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("Email transporter not available, skipping email send");
    return false;
  }

  const loginUrl = `${SITE_URL}/#login`;

  const mailOptions = {
    from: `"Orion AI" <${GMAIL_USER}>`,
    to: email,
    subject: "Orion AI - Seu acesso foi liberado!",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Seu acesso foi liberado!</h1>
        </div>
        <div class="content">
          <p>Olá <strong>${name}</strong>,</p>
          
          <p>Ótimas notícias! Seu pagamento foi confirmado e seu acesso ao Orion AI foi liberado.</p>
          
          <p>Você já pode usar todas as funcionalidades da plataforma com sua conta existente.</p>
          
          <div style="text-align: center;">
            <a href="${loginUrl}" class="button">Acessar Orion AI</a>
          </div>
          
          <p>Use suas credenciais habituais para fazer login. Se você esqueceu sua senha, pode redefini-la na página de login.</p>
          
          <p>Se você tiver alguma dúvida ou precisar de ajuda, não hesite em entrar em contato conosco.</p>
          
          <div class="footer">
            <p>Este é um email automático, por favor não responda.</p>
            <p>&copy; ${new Date().getFullYear()} Orion AI. Todos os direitos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Seu acesso foi liberado!

Olá ${name},

Ótimas notícias! Seu pagamento foi confirmado e seu acesso ao Orion AI foi liberado.

Você já pode usar todas as funcionalidades da plataforma com sua conta existente.

Acesse: ${loginUrl}

Use suas credenciais habituais para fazer login. Se você esqueceu sua senha, pode redefini-la na página de login.

Se você tiver alguma dúvida ou precisar de ajuda, não hesite em entrar em contato conosco.

Este é um email automático, por favor não responda.
    `.trim(),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully to existing user:", {
      email,
      messageId: info.messageId,
    });
    return true;
  } catch (error: any) {
    console.error("Error sending email to existing user:", {
      email,
      error: error.message,
    });
    return false;
  }
}

