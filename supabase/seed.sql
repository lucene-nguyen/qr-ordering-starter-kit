-- Demo data for Phở Mây Kitchen, matching docs/prototype/tabletap-prototype.html.
-- Safe to re-run: it clears the Phase 1 tables first.

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
