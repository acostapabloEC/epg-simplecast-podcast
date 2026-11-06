/**
 * notify.mjs — email Pablo via Office365 SMTP. Config via env vars
 * (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM).
 * Usage: node scripts/notify.mjs "<subject>" "<body>"
 * Requires nodemailer (installed by the workflow with --no-save).
 */
import nodemailer from 'nodemailer';

const [subject, body] = process.argv.slice(2);
if (!subject || !body) {
  console.error('Usage: node scripts/notify.mjs "<subject>" "<body>"');
  process.exit(1);
}
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = process.env;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: false,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

await transporter.sendMail({
  from: EMAIL_FROM || SMTP_USER,
  to: 'pabloacosta@eliteconsultingpartners.com',
  subject,
  text: body,
});
console.log('Notification sent.');
