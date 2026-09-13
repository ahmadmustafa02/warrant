import { describe, expect, it } from 'vitest';
import { userNamedDestructiveTool } from './destructiveIntent';

describe('userNamedDestructiveTool', () => {
  it('matches when the user names the tool', () => {
    expect(
      userNamedDestructiveTool('please run delete_account now', 'delete_account'),
    ).toBe(true);
  });

  it('matches destructive verbs in the tool name', () => {
    expect(userNamedDestructiveTool('export my data', 'purge_user_cache')).toBe(false);
    expect(userNamedDestructiveTool('purge the cache please', 'purge_user_cache')).toBe(
      true,
    );
  });
});
