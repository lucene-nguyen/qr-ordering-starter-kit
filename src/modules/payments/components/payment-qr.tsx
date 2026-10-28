import QRCode from "qrcode";
import { formatVnd } from "@/lib/money";
import { vietQrPayload, type VietQrInput } from "../vietqr";

/** The VietQR code, drawn on the server as SVG from the payment the database created. */
export async function PaymentQr(input: VietQrInput) {
  const svg = await QRCode.toString(vietQrPayload(input), { type: "svg", errorCorrectionLevel: "M", margin: 1 });
  return (
    // SVG generated on the server from our own payload (digits and A–Z only), not user input.
    <div role="img" aria-label={`VietQR code for ${formatVnd(input.amount)}`} className="size-44 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
