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
 * Sends email to new user with access credentials
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
    subject: "Welcome to Orion AI - Your Access Credentials",
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
          <h1>Welcome to Orion AI!</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${name}</strong>,</p>
          
          <p>Your purchase has been confirmed successfully! Your account has been created and is active.</p>
          
          <div class="credentials">
            <h3 style="margin-top: 0; color: #667eea;">Your access credentials:</h3>
            <div class="credential-item">
              <span class="label">Email:</span>
              <span class="value">${email}</span>
            </div>
            <div class="credential-item">
              <span class="label">Temporary password:</span>
              <span class="value">${password}</span>
            </div>
          </div>
          
          <p><strong>Important:</strong> For security reasons, you will need to change this password on your first login.</p>
          
          <div style="text-align: center;">
            <a href="${loginUrl}" class="button">Access Orion AI</a>
          </div>
          
          <p>If you have any questions or need help, please don't hesitate to contact us.</p>
          
          <div class="footer">
            <p>This is an automated email, please do not reply.</p>
            <p>&copy; ${new Date().getFullYear()} Orion AI. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Welcome to Orion AI!

Hello ${name},

Your purchase has been confirmed successfully! Your account has been created and is active.

Your access credentials:
Email: ${email}
Temporary password: ${password}

IMPORTANT: For security reasons, you will need to change this password on your first login.

Access: ${loginUrl}

If you have any questions or need help, please don't hesitate to contact us.

This is an automated email, please do not reply.
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
 * Sends email to existing user informing that access has been granted
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
    subject: "Orion AI - Your Access Has Been Granted!",
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
          <h1>Your Access Has Been Granted!</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${name}</strong>,</p>
          
          <p>Great news! Your payment has been confirmed and your access to Orion AI has been granted.</p>
          
          <p>You can now use all platform features with your existing account.</p>
          
          <div style="text-align: center;">
            <a href="${loginUrl}" class="button">Access Orion AI</a>
          </div>
          
          <p>Use your usual credentials to log in. If you forgot your password, you can reset it on the login page.</p>
          
          <p>If you have any questions or need help, please don't hesitate to contact us.</p>
          
          <div class="footer">
            <p>This is an automated email, please do not reply.</p>
            <p>&copy; ${new Date().getFullYear()} Orion AI. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Your Access Has Been Granted!

Hello ${name},

Great news! Your payment has been confirmed and your access to Orion AI has been granted.

You can now use all platform features with your existing account.

Access: ${loginUrl}

Use your usual credentials to log in. If you forgot your password, you can reset it on the login page.

If you have any questions or need help, please don't hesitate to contact us.

This is an automated email, please do not reply.
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

/**
 * Sends email to user informing that subscription has expired
 */
export async function sendSubscriptionExpiredEmail(
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
    subject: "Orion AI - Your Subscription Has Expired",
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
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
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
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Your Subscription Has Expired</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${name}</strong>,</p>
          
          <div class="warning">
            <p><strong>Important:</strong> Your Orion AI subscription has expired.</p>
          </div>
          
          <p>Your access to Orion AI has been temporarily suspended because your subscription payment period has ended.</p>
          
          <p>To continue using our services, please renew your subscription by making a new payment.</p>
          
          <div style="text-align: center;">
            <a href="${loginUrl}" class="button">Renew Subscription</a>
          </div>
          
          <p>Once your payment is confirmed, your access will be automatically restored and you'll be able to use all platform features again.</p>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
          
          <div class="footer">
            <p>This is an automated email, please do not reply.</p>
            <p>&copy; ${new Date().getFullYear()} Orion AI. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Your Subscription Has Expired

Hello ${name},

IMPORTANT: Your Orion AI subscription has expired.

Your access to Orion AI has been temporarily suspended because your subscription payment period has ended.

To continue using our services, please renew your subscription by making a new payment.

Access: ${loginUrl}

Once your payment is confirmed, your access will be automatically restored and you'll be able to use all platform features again.

If you have any questions or need assistance, please don't hesitate to contact us.

This is an automated email, please do not reply.
    `.trim(),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully for expired subscription:", {
      email,
      messageId: info.messageId,
    });
    return true;
  } catch (error: any) {
    console.error("Error sending expired subscription email:", {
      email,
      error: error.message,
    });
    return false;
  }
}
