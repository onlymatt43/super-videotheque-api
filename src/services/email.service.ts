import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 465,
      secure: (env.SMTP_PORT || 465) === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export interface EmailOptions {
  to?: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const transport = getTransporter();
  
  if (!transport) {
    logger.warn('Email non configuré, message ignoré:', options.subject);
    return;
  }

  try {
    const mailOptions = {
      from: env.SMTP_USER,
      to: options.to || env.ALERT_EMAIL,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text.replace(/\n/g, '<br>'),
    };

    await transport.sendMail(mailOptions);
    logger.info({ to: mailOptions.to, subject: options.subject }, 'Email envoyé');
  } catch (error) {
    logger.error({ error, options }, 'Erreur envoi email');
    throw error;
  }
}

export async function sendAlert(subject: string, message: string): Promise<void> {
  await sendEmail({
    to: env.ALERT_EMAIL,
    subject: `[ALERT] ${subject}`,
    text: message,
  });
}
