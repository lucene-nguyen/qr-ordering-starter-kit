const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: process.env.APP_TIMEZONE ?? "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
});

/** UTC timestamp → "14:05" in the restaurant's timezone. Server-side (reads APP_TIMEZONE). */
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));
