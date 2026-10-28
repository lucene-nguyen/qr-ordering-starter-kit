// Pure money helpers – no imports, so `node --test` can run them directly.

/**
 * Splits `total` VND between `people`: every share is rounded down to 1.000đ and the last person
 * pays the rest, so the shares always add up to exactly `total`.
 *
 * This is a COPY of the rule in the database (request_payment), kept to test the rule and for
 * server-side previews. The DATABASE IS THE SOURCE OF TRUTH: what a guest pays (and what goes into
 * the VietQR code) is always `payments.amount` returned by request_payment, never this function's
 * result, and never computed on the client. The database applies it one payer at a time:
 * `splitEvenly(stillOpen, peopleNotPaidYet)[0]`.
 */
export function splitEvenly(total: number, people: number): number[] {
  if (!Number.isInteger(total) || total <= 0) throw new RangeError("total must be a positive whole number of VND");
  if (!Number.isInteger(people) || people < 1) throw new RangeError("people must be a whole number ≥ 1");
  if (people * 1000 > total) throw new RangeError("each share must be at least 1.000đ");
  const share = Math.floor(total / people / 1000) * 1000;
  return [...Array<number>(people - 1).fill(share), total - share * (people - 1)];
}
