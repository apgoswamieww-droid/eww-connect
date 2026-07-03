import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
  },
});

export async function sendEmail(to: string, subject: string, text: string) {
  if (!process.env.SMTP_HOST) return; // silently skip if SMTP not configured
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "noreply@eww-connect.local",
      to,
      subject,
      text,
    });
  } catch {
    // fail silently - email is best-effort
  }
}
