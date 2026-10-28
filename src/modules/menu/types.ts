import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];

export type MenuItem = Tables["menu_items"]["Row"];
export type MenuCategory = Tables["categories"]["Row"] & { menu_items: MenuItem[] };
