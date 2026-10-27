import { join } from "node:path";

export const PUBLICATION_ROOT_RELATIVE = ".data/market-baseline/publication";

export function publicationRoot(cwd = process.cwd()): string {
  return join(cwd, PUBLICATION_ROOT_RELATIVE);
}

export function publicationDir(contentSha256: string, cwd = process.cwd()): string {
  return join(publicationRoot(cwd), contentSha256);
}

export function publicationIndexPath(contentSha256: string, cwd = process.cwd()): string {
  return join(publicationDir(contentSha256, cwd), "index.json");
}

export function publicationTldShardPath(
  contentSha256: string,
  tldAsciiLabel: string,
  cwd = process.cwd(),
): string {
  return join(publicationDir(contentSha256, cwd), "tlds", `${tldAsciiLabel}.json`);
}

export function publicationCurrentPointerPath(cwd = process.cwd()): string {
  return join(publicationRoot(cwd), "current.json");
}

export function tldShardRelativePath(tldAsciiLabel: string): string {
  return `tlds/${tldAsciiLabel}.json`;
}
