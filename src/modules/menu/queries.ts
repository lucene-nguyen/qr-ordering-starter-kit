import { z } from "zod";
import { createSupabaseClient } from "@/lib/supabase/server";
import type { MenuCategory, MenuItemWithOptions } from "./types";

/** "Phở bò" → "pho bo", so guests can search without typing Vietnamese accents. */
const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();

/** Categories with their dishes, both in menu order. `search` keeps only matching dishes. */
export async function getMenu(search = ""): Promise<MenuCategory[]> {
  const { data, error } = await createSupabaseClient()
    .from("categories")
    .select("*, menu_items(*)")
    .order("sort")
    .order("sort", { referencedTable: "menu_items" });
  if (error) throw error;

  const q = fold(search.trim());
  if (!q) return data;
  // shortcut: filters in JS – fine for one restaurant's menu; move to a Postgres search if menus get big.
  return data
    .map((c) => ({
      ...c,
      menu_items: c.menu_items.filter((i) => fold(`${i.name} ${i.description ?? ""}`).includes(q)),
    }))
    .filter((c) => c.menu_items.length > 0);
}

/** A dish with its sizes and add-ons, in menu order. */
export async function getMenuItem(id: string): Promise<MenuItemWithOptions | null> {
  if (!z.uuid().safeParse(id).success) return null; // Postgres would reject a malformed uuid with an error
  const { data, error } = await createSupabaseClient()
    .from("menu_items")
    .select("*, menu_item_sizes(*), menu_item_addons(*)")
    .eq("id", id)
    .order("sort", { referencedTable: "menu_item_sizes" })
    .order("sort", { referencedTable: "menu_item_addons" })
    .maybeSingle();
  if (error) throw error;
  return data;
}
