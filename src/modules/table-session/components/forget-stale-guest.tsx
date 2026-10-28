"use client";

import { useEffect } from "react";
import { forgetGuest } from "../actions";

/** Rendered when this phone's guest cookie belongs to a closed session: removes it once. */
export function ForgetStaleGuest({ tableCode }: { tableCode: string }) {
  useEffect(() => {
    void forgetGuest(tableCode);
  }, [tableCode]);
  return null;
}
