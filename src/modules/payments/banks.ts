// Common Vietnamese banks and their NAPAS BIN (the id VietQR puts in the QR). Pure – no imports.
// shortcut: a static list of popular banks; add a bank here when a restaurant needs it (check the
// BIN on the NAPAS / VietQR bank list first).
export const BANKS = [
  { bin: "970436", name: "Vietcombank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970405", name: "Agribank" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970422", name: "MB Bank" },
  { bin: "970416", name: "ACB" },
  { bin: "970432", name: "VPBank" },
  { bin: "970403", name: "Sacombank" },
  { bin: "970423", name: "TPBank" },
  { bin: "970437", name: "HDBank" },
  { bin: "970441", name: "VIB" },
  { bin: "970443", name: "SHB" },
  { bin: "970448", name: "OCB" },
  { bin: "970440", name: "SeABank" },
  { bin: "970426", name: "MSB" },
  { bin: "970431", name: "Eximbank" },
  { bin: "970449", name: "LPBank" },
] as const;

/** "970436" → "Vietcombank"; null for a BIN not in the list. */
export const bankName = (bin: string) => BANKS.find((b) => b.bin === bin)?.name ?? null;

/**
 * The account holder name as banks print it: upper case, no Vietnamese marks ("Phở Mây" → "PHO MAY").
 * The database checks the result (^[A-Z0-9 ]{1,50}$).
 */
export const accountHolder = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "D").toUpperCase().replace(/\s+/g, " ").trim();
