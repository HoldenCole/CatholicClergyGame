import { describe, expect, it } from 'vitest';
import { credentialLabel, credentialList } from '@/systems/credentials';

describe('systems/credentials', () => {
  it('names a credential in words: languages by their label, degrees as a diocese says them, the rest from a short table', () => {
    expect(credentialLabel('spanish')).toBe('Spanish');
    expect(credentialLabel('latin')).toBe('Latin');
    expect(credentialLabel('cpe_unit')).toBe('a unit of clinical pastoral education');
    expect(credentialLabel('JCL')).toContain('canon law');
    expect(credentialLabel('italian_basic')).toContain('Italian');
    // An id nobody labelled still reads as words, never as an identifier.
    expect(credentialLabel('some_new_thing')).toBe('some new thing');
  });

  it('lists them as a sentence fragment', () => {
    expect(credentialList(['spanish'])).toBe('Spanish');
    expect(credentialList(['spanish', 'latin', 'cpe_unit'])).toBe('Spanish, Latin, and a unit of clinical pastoral education');
    expect(credentialList([])).toBe('');
  });
});
