import { z } from "zod";

/** What the guest's phone may send. Prices are deliberately absent: the database sets them. */
export const placeOrderInput = z.object({
  tableCode: z.string().min(1).max(10),
  idempotencyKey: z.uuid(),
  lines: z
    .array(
      z.object({
        menuItemId: z.uuid(),
        sizeId: z.uuid().nullable(),
        addonIds: z.array(z.uuid()).max(10),
        note: z.string().trim().max(80),
        qty: z.int().min(1).max(50),
      }),
    )
    .min(1)
    .max(50),
});

export type PlaceOrderInput = z.input<typeof placeOrderInput>;
