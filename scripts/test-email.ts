import "dotenv/config";
import nodemailer from "nodemailer";

const to = process.argv[2] || "universoastral99@gmail.com";
const user = process.env.GMAIL_USER || "";
const passRaw = process.env.GMAIL_PASS || "";
const pass = passRaw.replace(/\s+/g, "");

console.log("SITE_URL:", process.env.SITE_URL || "(not set)");
console.log("GMAIL_USER:", user ? `${user.slice(0, 3)}...` : "MISSING");
console.log("GMAIL_PASS raw length:", passRaw.length, "| normalized:", pass.length);

if (!user || !pass) {
  console.error("Configure GMAIL_USER and GMAIL_PASS in .env");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user, pass },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
});

try {
  await transporter.verify();
  console.log("SMTP verify: OK");
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("SMTP verify FAILED:", message);
  process.exit(1);
}

try {
  const info = await transporter.sendMail({
    from: `"Orion AI Test" <${user}>`,
    to,
    subject: `Orion AI email test ${new Date().toISOString()}`,
    text: `Teste Orion AI (${process.env.SITE_URL || "SITE_URL missing"}). Gmail SMTP OK se recebeu este email.`,
    html: `<p>Teste <strong>Orion AI</strong> — domínio: <a href="${process.env.SITE_URL || "#"}">${process.env.SITE_URL || "SITE_URL missing"}</a></p>`,
  });
  console.log("Email sent:", info.messageId);
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("Send FAILED:", message);
  process.exit(1);
}
