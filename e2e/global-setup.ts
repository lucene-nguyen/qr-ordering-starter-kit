import { assertDevDatabase } from "./guard";

/** Second check, right before the tests run (the first one runs when the config loads). */
export default function globalSetup() {
  assertDevDatabase();
}
