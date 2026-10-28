// Shared by server pages and client components (no server-only imports here).

export type SharedCartLine = {
  id: string;
  name: string;
  options: string; // "Large · Extra beef"
  note: string | null;
  qty: number;
  unitPrice: number; // display only – place_session_order prices again from the database
  addedBy: string; // "you" or a guest's name
};

export const cartCount = (lines: SharedCartLine[]) => lines.reduce((n, l) => n + l.qty, 0);
export const cartTotal = (lines: SharedCartLine[]) => lines.reduce((n, l) => n + l.unitPrice * l.qty, 0);
