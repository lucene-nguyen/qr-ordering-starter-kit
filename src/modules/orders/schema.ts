import { z } from "zod";

/** A line the guest's phone may add. Prices are deliberately absent: the database sets them. */
export const cartLineInput = z.object({
  menuItemId: z.uuid(),
  sizeId: z.uuid().nullable(),
  addonIds: z.array(z.uuid()).max(10),
  note: z.string().max(80),
  qty: z.int().min(1).max(50),
});

export type CartLineInput = z.input<typeof cartLineInput>;

export const tableCodeInput = z.string().min(1).max(10);
export const deltaInput = z.int().min(-50).max(50).refine((d) => d !== 0);
export const cartVersionInput = z.int().min(0);
