type NotificationEnv = Partial<Pick<CloudflareEnv, "FAMILY_EMAIL">> & { NOTIFICATION_FROM?: string; NOTIFICATION_REVIEW_URL?: string; MODERATOR_EMAILS?: string };
export async function notifyFamily(env: NotificationEnv): Promise<boolean> {
  const recipients = [...new Set((env.MODERATOR_EMAILS || "").split(",").map(value => value.trim()).filter(Boolean))];
  if (!env.FAMILY_EMAIL || !env.NOTIFICATION_FROM || !env.NOTIFICATION_REVIEW_URL || !recipients.length) return false;
  try {
    const review = new URL(env.NOTIFICATION_REVIEW_URL);
    if (review.protocol !== "https:" || recipients.length > 20) return false;
    // Keep the submission and photographs inside the authenticated review area.
    // No contributor words, names, email addresses, or attachments go into email.
    await env.FAMILY_EMAIL.send({
      from: env.NOTIFICATION_FROM,
      bcc: recipients,
      subject: "A memory is waiting for family approval",
      text: `A new memory has been shared on your memorial. It is private until approved.\n\nSign in to review it: ${review.href}\n\nAn invited family manager can approve or decline it.`,
      html: `<p>A new memory has been shared on your memorial. It is private until approved.</p><p><a href="${review.href.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}">Sign in to review</a></p><p>An invited family manager can approve or decline it.</p>`,
    });
    return true;
  } catch {
    // Saving the memory succeeds even if email is temporarily unavailable.
    // The response then uses the review-queue confirmation rather than claiming notification.
    console.error(JSON.stringify({ event: "family_notification_unavailable" }));
    return false;
  }
}
