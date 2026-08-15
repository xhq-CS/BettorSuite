import { logger } from "./logger";

type PasswordResetEmail = {
  to: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail({ to, resetUrl }: PasswordResetEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    logger.warn("Password recovery email skipped because RESEND_API_KEY or EMAIL_FROM is not configured");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Reset your BettorSuite password",
        html: `
        <div style="font-family:Arial,sans-serif;color:#0f172a;max-width:560px;margin:auto">
          <h1 style="font-size:24px">Reset your password</h1>
          <p>We received a request to reset your BettorSuite password. This secure link expires in 30 minutes and can only be used once.</p>
          <p style="margin:28px 0"><a href="${resetUrl}" style="background:#2563eb;color:white;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Reset password</a></p>
          <p style="font-size:13px;color:#64748b">If you did not request this, you can ignore this email. Your password will not change.</p>
        </div>`,
        text: `Reset your BettorSuite password: ${resetUrl}\n\nThis link expires in 30 minutes and can only be used once. If you did not request it, ignore this email.`,
      }),
    });

    if (!response.ok) {
      logger.error({ status: response.status }, "Password recovery email failed");
      return false;
    }
    return true;
  } catch (error) {
    logger.error({ err: error }, "Password recovery email request failed");
    return false;
  }
}
