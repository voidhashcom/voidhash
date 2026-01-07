import { createBetterAuthOptions } from "@voidhash/auth";
import { db } from "@voidhash/db";
import { type User, betterAuth } from "better-auth";
import { Resend } from "resend";

import { env } from "./env";

// Initialize Resend if API key is available
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export const auth = betterAuth({
  ...createBetterAuthOptions({
    baseURL: env.VITE_APP_AUTH_BASE_URL,
    db,
    trustedClientIds: new Set([
      env.VOIDHASH_STUDIO_CLIENT_ID,
      env.VOIDHASH_MOBILE_CLIENT_ID,
    ]),
  }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }: { user: User; url: string }) => {
      if (!(resend && env.EMAIL_FROM)) {
        // biome-ignore lint/suspicious/noConsole: we want to log the error
        console.error(
          "Resend not configured - cannot send password reset email"
        );
        return;
      }

      await resend.emails.send({
        from: env.EMAIL_FROM,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1a1a1a;">Reset your password</h1>
            <p style="color: #666; font-size: 16px; line-height: 1.5;">
              Hi ${user.name || "there"},
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.5;">
              We received a request to reset your password. Click the button below to choose a new password:
            </p>
            <div style="margin: 32px 0;">
              <a href="${url}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px; line-height: 1.5;">
              If you didn't request this, you can safely ignore this email. The link will expire in 1 hour.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
            <p style="color: #999; font-size: 12px;">
              Voidhash - Building the future
            </p>
          </div>
        `,
        subject: "Reset your Voidhash password",
        to: user.email,
      });
    },
  },
});
