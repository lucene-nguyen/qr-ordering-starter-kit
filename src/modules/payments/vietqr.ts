// VietQR payload builder (EMVCo QR / NAPAS 247). Pure – no imports, so `node --test` runs it directly.
// The QR image is drawn from this string with `qrcode`; no external QR service is involved.

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as 4 upper-case hex digits – EMVCo field 63. */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8; // payloads are ASCII only (see transferNote)
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** EMVCo TLV: 2-digit id, 2-digit length, value. */
function tlv(id: string, value: string) {
  if (value.length > 99) throw new RangeError(`field ${id} is longer than 99 characters`);
  return id + String(value.length).padStart(2, "0") + value;
}

/** Banking apps accept plain ASCII in the transfer note: "Tbl05 Phở" → "TBL05 PHO", max 25 chars. */
export function transferNote(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 25);
}

export type VietQrInput = {
  bin: string; // NAPAS bank id, e.g. "970436" (Vietcombank)
  accountNo: string;
  amount: number; // whole VND
  note: string; // e.g. "TBL05 A0421"
};

/** The string to encode in the guest's QR: transfer `amount` to the account with `note`. */
export function vietQrPayload({ bin, accountNo, amount, note }: VietQrInput): string {
  if (!/^[0-9]{6}$/.test(bin)) throw new RangeError("bin must be 6 digits");
  if (!/^[0-9]{6,19}$/.test(accountNo)) throw new RangeError("accountNo must be 6–19 digits");
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new RangeError("amount must be a positive whole number of VND");

  const body =
    tlv("00", "01") + // payload format
    tlv("01", "12") + // dynamic QR: amount fixed, one payment
    tlv("38", tlv("00", "A000000727") + tlv("01", tlv("00", bin) + tlv("01", accountNo)) + tlv("02", "QRIBFTTA")) +
    tlv("53", "704") + // VND
    tlv("54", String(amount)) +
    tlv("58", "VN") +
    tlv("62", tlv("08", transferNote(note))) +
    "6304"; // CRC field id + length; the CRC covers everything up to here
  return body + crc16(body);
}
