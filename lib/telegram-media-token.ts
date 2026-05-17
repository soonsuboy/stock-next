import { createHash, timingSafeEqual } from "crypto";

function mediaTokenSecret() {
  return (
    process.env.TELEGRAM_MEDIA_TOKEN_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "local-development-telegram-media-token"
  );
}

export function createTelegramMediaToken(
  chatId: string,
  messageId: string | number,
  mediaIndex: string | number
) {
  return createHash("sha256")
    .update(
      [
        mediaTokenSecret(),
        String(chatId),
        String(messageId),
        String(mediaIndex),
      ].join(":")
    )
    .digest("hex")
    .slice(0, 32);
}

export function isValidTelegramMediaToken(
  token: string,
  chatId: string,
  messageId: string | number,
  mediaIndex: string | number
) {
  const expected = createTelegramMediaToken(chatId, messageId, mediaIndex);
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  return (
    tokenBuffer.length === expectedBuffer.length &&
    timingSafeEqual(tokenBuffer, expectedBuffer)
  );
}
