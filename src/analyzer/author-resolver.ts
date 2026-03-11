import type { CommitRecord, AuthorAlias } from '../types/index.js';

/**
 * 根据别名映射表将 CommitRecord 中的 author/email 统一为 canonical 身份
 */
export function resolveAuthors(
  commits: CommitRecord[],
  aliases: AuthorAlias[]
): CommitRecord[] {
  if (aliases.length === 0) return commits;

  const lookupByEmail = new Map<string, AuthorAlias>();
  const lookupByName = new Map<string, AuthorAlias>();

  for (const alias of aliases) {
    for (const entry of alias.aliases) {
      if (entry.email) lookupByEmail.set(entry.email.toLowerCase(), alias);
      if (entry.name) lookupByName.set(entry.name.toLowerCase(), alias);
    }
    lookupByEmail.set(alias.email.toLowerCase(), alias);
  }

  return commits.map((commit) => {
    const matched =
      lookupByEmail.get(commit.email.toLowerCase()) ||
      lookupByName.get(commit.author.toLowerCase());

    if (!matched) return commit;

    return {
      ...commit,
      author: matched.canonical,
      email: matched.email,
    };
  });
}
