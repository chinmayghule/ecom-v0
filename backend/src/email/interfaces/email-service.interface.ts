/**
 * An email the backend can send, already rendered.
 *
 * `send` stays on the interface because it is the only shape a transactional
 * provider can implement generically — a subject and a body are all Resend
 * needs. Purpose-specific methods sit alongside it rather than replacing it,
 * so adding a second email type does not force the interface to grow a
 * `sendOrderConfirmation` per feature.
 */
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface PasswordResetEmail {
  /** Recipient. */
  to: string;
  /** Fully-built URL, including the FRONTEND_URL origin and `?token=`. */
  resetUrl: string;
  /** Lifetime of the reset token, so the copy can state it. */
  expiresInHours: number;
}

export interface EmailService {
  send(options: EmailOptions): Promise<void>;

  /**
   * Sends a password-reset link.
   *
   * Takes the values, not a rendered template. Rendering is the transport's
   * job: only the production transport has a reason to care about HTML, and
   * the console transport wants a plain URL it can copy, not markup. When the
   * caller assembled the HTML itself, a missing template became a synchronous
   * `readFileSync` throw inside `forgotPassword` — a 500 for a user who only
   * asked to reset a password.
   */
  sendPasswordReset(email: PasswordResetEmail): Promise<void>;
}
