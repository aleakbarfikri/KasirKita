import { randomUUID } from "node:crypto";

export function createId(prefix = "id") {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}
