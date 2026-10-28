-- Demo data for Phở Mây Kitchen, matching docs/prototype/tabletap-prototype.html.
-- Safe to re-run: it clears the menu and tables first (and, via cascade, any orders).

truncate public.menu_items, public.categories, public.tables cascade;

insert into public.categories (name, sort) values
  ('Phở & Noodles', 1), ('Rice', 2), ('Starters', 3), ('Drinks', 4), ('Desserts', 5);

insert into public.menu_items (category_id, name, description, price, is_popular, is_available, sort)
select c.id, m.name, m.description, m.price, m.is_popular, m.is_available, m.sort
from (values
  ('Phở & Noodles', 'Phở bò tái', 'Rare beef, slow-simmered bone broth, fresh herbs', 65000, true, true, 1),
  ('Phở & Noodles', 'Bún bò Huế', 'Spicy lemongrass beef broth with thick vermicelli', 70000, false, true, 2),
  ('Phở & Noodles', 'Bún chả Hà Nội', 'Grilled pork patties, rice vermicelli, fish sauce dip', 60000, true, true, 3),
  ('Rice', 'Cơm tấm sườn', 'Broken rice, grilled pork chop, pickles, scallion oil', 55000, true, true, 1),
  ('Rice', 'Cơm gà Hội An', 'Turmeric chicken rice with green papaya salad', 60000, false, true, 2),
  ('Starters', 'Gỏi cuốn tôm', 'Fresh spring rolls with shrimp and peanut sauce', 45000, true, true, 1),
  ('Starters', 'Chả giò', 'Crispy pork spring rolls, herbs, dipping sauce', 50000, false, true, 2),
  ('Drinks', 'Trà đá chanh', 'Iced lemon tea, lightly sweetened', 15000, true, true, 1),
  ('Drinks', 'Cà phê sữa đá', 'Vietnamese iced coffee with condensed milk', 29000, false, true, 2),
  ('Desserts', 'Chè ba màu', 'Three-color sweet soup with coconut milk', 25000, false, false, 1)
) as m(category, name, description, price, is_popular, is_available, sort)
join public.categories c on c.name = m.category;

insert into public.tables (code, label)
select lpad(n::text, 2, '0'), 'Table ' || lpad(n::text, 2, '0')
from generate_series(1, 12) as n;

-- Phase 2: sizes and add-ons (dishes with a single size get none).
insert into public.menu_item_sizes (menu_item_id, name, extra_price, sort)
select m.id, s.name, s.extra_price, s.sort
from (values
  ('Phở bò tái', 'Regular', 0, 1), ('Phở bò tái', 'Large', 15000, 2),
  ('Bún bò Huế', 'Regular', 0, 1), ('Bún bò Huế', 'Large', 15000, 2),
  ('Bún chả Hà Nội', 'Regular', 0, 1), ('Bún chả Hà Nội', 'Large', 15000, 2),
  ('Cơm tấm sườn', 'Regular', 0, 1), ('Cơm tấm sườn', 'Large', 15000, 2),
  ('Cơm gà Hội An', 'Regular', 0, 1), ('Cơm gà Hội An', 'Large', 15000, 2),
  ('Gỏi cuốn tôm', '2 rolls', 0, 1), ('Gỏi cuốn tôm', '4 rolls', 40000, 2),
  ('Chả giò', '4 rolls', 0, 1), ('Chả giò', '8 rolls', 45000, 2),
  ('Trà đá chanh', 'Regular', 0, 1), ('Trà đá chanh', 'Large', 5000, 2),
  ('Cà phê sữa đá', 'Regular', 0, 1), ('Cà phê sữa đá', 'Large', 5000, 2)
) as s(item, name, extra_price, sort)
join public.menu_items m on m.name = s.item;

insert into public.menu_item_addons (menu_item_id, name, extra_price, sort)
select m.id, a.name, a.extra_price, a.sort
from (values
  ('Phở bò tái', 'Extra beef', 20000, 1), ('Phở bò tái', 'Poached egg', 10000, 2), ('Phở bò tái', 'Extra noodles', 10000, 3),
  ('Bún bò Huế', 'Extra beef', 20000, 1), ('Bún bò Huế', 'Pork knuckle', 15000, 2),
  ('Bún chả Hà Nội', 'Extra grilled pork', 20000, 1), ('Bún chả Hà Nội', 'Fried spring roll', 15000, 2),
  ('Cơm tấm sườn', 'Fried egg', 8000, 1), ('Cơm tấm sườn', 'Shredded pork skin', 8000, 2),
  ('Cơm gà Hội An', 'Extra chicken', 20000, 1),
  ('Trà đá chanh', 'Less sugar', 0, 1), ('Trà đá chanh', 'No ice', 0, 2),
  ('Cà phê sữa đá', 'Less sweet', 0, 1), ('Cà phê sữa đá', 'Extra shot', 10000, 2)
) as a(item, name, extra_price, sort)
join public.menu_items m on m.name = a.item;
