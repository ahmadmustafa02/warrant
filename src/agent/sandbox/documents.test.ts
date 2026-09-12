import { describe, expect, it } from 'vitest';
import {
  createDocumentStore,
  DEFAULT_DOCUMENT_ID,
  readDocumentContent,
} from './documents';

describe('createDocumentStore', () => {
  it('places the injected line inside the default document', () => {
    const store = createDocumentStore('INJECTED LINE');
    expect(readDocumentContent(store, DEFAULT_DOCUMENT_ID)).toContain('INJECTED LINE');
  });

  it('isolates concurrent runs from each other', () => {
    const first = createDocumentStore('FIRST');
    const second = createDocumentStore('SECOND');

    expect(readDocumentContent(first, DEFAULT_DOCUMENT_ID)).toContain('FIRST');
    expect(readDocumentContent(first, DEFAULT_DOCUMENT_ID)).not.toContain('SECOND');
    expect(readDocumentContent(second, DEFAULT_DOCUMENT_ID)).toContain('SECOND');
  });

  it('returns undefined for unknown document ids', () => {
    const store = createDocumentStore('anything');
    expect(readDocumentContent(store, 'doc-404')).toBeUndefined();
  });
});
