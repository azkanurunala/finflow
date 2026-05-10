/**
 * G4 — audit-i18n script self-test. Validates the regex-based heuristics on
 * fixture strings without scanning the real tree (slower + dependent on
 * ongoing migration progress).
 */

import { findHardcodedStrings } from '../scripts/audit-i18n';

describe('G4 — audit-i18n heuristics', () => {
  it('flags raw JSX <Text> bodies', () => {
    const code = `
      <Text>Welcome back</Text>
      <Text>Please sign in</Text>
    `;
    const found = findHardcodedStrings('virtual.tsx', code);
    const snippets = found.map((f) => f.snippet);
    expect(snippets).toEqual(expect.arrayContaining(['Welcome back', 'Please sign in']));
    expect(found.every((f) => f.rule === 'jsx-text')).toBe(true);
  });

  it('skips <Text> bodies that already use t(...)', () => {
    const code = `<Text>{t('welcome.title')}</Text>`;
    expect(findHardcodedStrings('virtual.tsx', code)).toEqual([]);
  });

  it('flags hardcoded placeholders', () => {
    const code = `<TextInput placeholder="Enter your email" />`;
    const found = findHardcodedStrings('virtual.tsx', code);
    expect(found).toHaveLength(1);
    expect(found[0].rule).toBe('attribute');
    expect(found[0].snippet).toContain('Enter your email');
  });

  it('flags Alert.alert literal first arg', () => {
    const code = `Alert.alert("Error", "Something went wrong");`;
    const found = findHardcodedStrings('virtual.tsx', code);
    expect(found.find((f) => f.rule === 'alert')?.snippet).toBe('Error');
  });

  it('does not flag Alert.alert when wrapped in t()', () => {
    const code = `Alert.alert(t('common.error'), t('common.unknown'));`;
    expect(findHardcodedStrings('virtual.tsx', code)).toEqual([]);
  });

  it('skips numeric / punctuation-only / single-character bodies', () => {
    const code = `
      <Text>$</Text>
      <Text>123</Text>
      <Text>•</Text>
    `;
    expect(findHardcodedStrings('virtual.tsx', code)).toEqual([]);
  });

  it('ignores pure-lowercase identifier-shaped strings (likely keys not visible UI)', () => {
    // The audit deliberately skips pure-lowercase identifiers (`username`, `email`)
    // which are usually field names. CamelCase like `userName` is left in so a
    // reviewer can dismiss it.
    const code = `<Text>username</Text>`;
    expect(findHardcodedStrings('virtual.tsx', code)).toEqual([]);
  });
});
