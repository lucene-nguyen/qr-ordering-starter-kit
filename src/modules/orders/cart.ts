"use client";

import { useSyncExternalStore } from "react";

export type CartLine = {
  menuItemId: string;
  name: string;
  sizeId: string | null;
  sizeName: string | null;
  addons: { id: string; name: string }[];
  note: string;
  qty: number;
  unitPrice: number; // for display only – the server recomputes every price
};

/**
 * The cart lives in localStorage, one per table, so a reload or a failed request never loses it.
 * `idempotencyKey` belongs to the cart's current contents: every retry of the same cart reuses it,
 * and any change to the cart clears it so the next submit is a new order.
 */
type Cart = { lines: CartLine[]; idempotencyKey: string | null };

const EMPTY: Cart = { lines: [], idempotencyKey: null };
const storageKey = (table: string) => `tabletap:cart:${table}`;
const listeners = new Set<() => void>();
let cache: { raw: string | null; cart: Cart } = { raw: null, cart: EMPTY };

function read(table: string): Cart {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(storageKey(table));
  } catch {} // storage blocked: behave as an empty cart
  if (raw !== cache.raw) {
    let cart = EMPTY;
    try {
      cart = raw ? (JSON.parse(raw) as Cart) : EMPTY;
    } catch {} // corrupted value: start over
    cache = { raw, cart }; // same string → same object, as useSyncExternalStore requires
  }
  return cache.cart;
}

function write(table: string, cart: Cart) {
  try {
    localStorage.setItem(storageKey(table), JSON.stringify(cart));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange); // other tabs on the same phone
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The table's cart, or `null` until the browser has loaded it (server render, hydration). */
export function useCart(table: string): Cart | null {
  return useSyncExternalStore(subscribe, () => read(table), () => null);
}

const sameChoice = (a: CartLine, b: CartLine) =>
  a.menuItemId === b.menuItemId &&
  a.sizeId === b.sizeId &&
  a.note === b.note &&
  a.addons.map((x) => x.id).sort().join() === b.addons.map((x) => x.id).sort().join();

export function addToCart(table: string, line: CartLine) {
  const { lines } = read(table);
  const i = lines.findIndex((l) => sameChoice(l, line));
  const next = i < 0 ? [...lines, line] : lines.map((l, j) => (j === i ? { ...l, qty: l.qty + line.qty } : l));
  write(table, { lines: next, idempotencyKey: null });
}

/** qty 0 removes the line. */
export function setLineQty(table: string, index: number, qty: number) {
  const { lines } = read(table);
  const next = qty > 0 ? lines.map((l, j) => (j === index ? { ...l, qty } : l)) : lines.filter((_, j) => j !== index);
  write(table, { lines: next, idempotencyKey: null });
}

export function clearCart(table: string) {
  write(table, EMPTY);
}

/** The key for submitting the current cart: created once, reused by every retry. */
export function submissionKey(table: string) {
  const cart = read(table);
  if (cart.idempotencyKey) return cart.idempotencyKey;
  const key = crypto.randomUUID();
  write(table, { ...cart, idempotencyKey: key });
  return key;
}

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty, 0);
export const cartTotal = (lines: CartLine[]) => lines.reduce((n, l) => n + l.unitPrice * l.qty, 0);
