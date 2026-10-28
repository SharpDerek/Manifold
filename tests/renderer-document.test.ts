import { describe, expect, it } from 'vitest';
import { matchesRendererDocument } from '../src/main/renderer-document';

describe('IPC renderer document validation', () => {
  it('accepts Chromium canonicalization of the Forge development URL', () => {
    expect(
      matchesRendererDocument(
        'http://localhost:5173/',
        'http://localhost:5173',
      ),
    ).toBe(true);
  });
  it('accepts the exact production document with encoded spaces', () => {
    const url = 'file:///C:/Program%20Files/Manifold/renderer/index.html';
    expect(matchesRendererDocument(url, url)).toBe(true);
  });
  it.each([
    'http://localhost:5174/',
    'http://localhost.evil.test:5173/',
    'http://localhost:5173/other.html',
    'http://localhost:5173/?unexpected=1',
    'http://localhost:5173/#unexpected',
    'https://localhost:5173/',
    'http://attacker@localhost:5173/',
    'about:blank',
    '',
    'not a URL',
  ])('rejects an unexpected document: %s', (actual) => {
    expect(matchesRendererDocument(actual, 'http://localhost:5173')).toBe(
      false,
    );
  });
  it('rejects a different local file despite the shared file protocol', () => {
    expect(
      matchesRendererDocument(
        'file:///C:/other/index.html',
        'file:///C:/Manifold/renderer/index.html',
      ),
    ).toBe(false);
  });
  it('fails closed for an invalid configured URL', () => {
    expect(matchesRendererDocument('http://localhost:5173/', 'invalid')).toBe(
      false,
    );
  });
});
