import "server-only";

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: false
});

type SendAuthEmailInput = {
  to: string;
  subject: string;
  heading: string;
  message: string;
  actionLabel: string;
  url: string;
};

export async function sendAuthEmail(input: SendAuthEmailInput) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "Auth Lab <auth@auth-lab.local>",
    to: input.to,
    subject: input.subject,
    text: `${input.heading}\n\n${input.message}\n\n${input.url}`,
    html: `
      <div style="background:#08110f;padding:40px;font-family:ui-monospace,monospace;color:#d9e7e1">
        <div style="max-width:560px;margin:auto;border:1px solid #29443c;border-radius:16px;padding:32px;background:#0d1714">
          <p style="color:#70f5b0;text-transform:uppercase;letter-spacing:.16em;font-size:12px">Auth Lab · local sandbox</p>
          <h1 style="font:600 24px ui-sans-serif,sans-serif;color:#f2faf6">${input.heading}</h1>
          <p style="line-height:1.7;color:#a9bbb4">${input.message}</p>
          <a href="${input.url}" style="display:inline-block;margin-top:16px;padding:12px 18px;border-radius:8px;background:#70f5b0;color:#07110d;text-decoration:none;font-weight:700">${input.actionLabel}</a>
          <p style="margin-top:24px;font-size:12px;color:#698078;word-break:break-all">${input.url}</p>
        </div>
      </div>
    `
  });
}
