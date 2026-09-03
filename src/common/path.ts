import path from "node:path";

export function toRepositoryPath(value: string): string {
  return value.split(path.sep).join("/");
}
