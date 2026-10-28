import QRCode from "qrcode";
import { Icon } from "@/lib/icons";

/**
 * Printable table card. Error correction "H" survives ~30% of the code being covered, which is
 * what lets the restaurant logo sit in the middle (logo ≈ 22% of the width).
 */
export async function TableQrCard({ url, label }: { url: string; label: string }) {
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "H", margin: 1 });

  return (
    <figure className="flex break-inside-avoid flex-col items-center gap-2 rounded-md border border-border p-3.5 text-center">
      <div className="relative size-40">
        {/* SVG generated on the server from our own URL, not user input. */}
        <div className="size-full [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <span className="absolute inset-0 m-auto grid size-[22%] place-items-center rounded-full bg-brand text-white ring-4 ring-bg">
          <Icon name="utensils" size={18} />
        </span>
      </div>
      <figcaption className="flex flex-col">
        <span className="text-heading">{label}</span>
        <span className="text-caption break-all text-muted">{url.replace(/^https?:\/\//, "")}</span>
      </figcaption>
    </figure>
  );
}
