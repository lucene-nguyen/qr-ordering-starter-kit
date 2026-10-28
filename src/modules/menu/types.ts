import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];

export type MenuItem = Tables["menu_items"]["Row"];
export type MenuItemOption = Tables["menu_item_sizes"]["Row"]; // sizes and add-ons share a shape
export type MenuCategory = Tables["categories"]["Row"] & { menu_items: MenuItem[] };
export type MenuItemWithOptions = MenuItem & {
  menu_item_sizes: MenuItemOption[];
  menu_item_addons: MenuItemOption[];
};
