import type { CreationContent } from '@/types';
import origins from './origins.json';
import ties from './ties.json';
import paths from './paths.json';
import fields from './fields.json';
import careers from './careers.json';
import motives from './motives.json';
import families from './families.json';
import pasts from './pasts.json';
import religious from './religious.json';
import type { CreationOption, ProvinceTie, WhyOrder } from '@/types';

export const creationContent: CreationContent = {
  origins: origins as CreationContent['origins'],
  ties: ties as CreationContent['ties'],
  paths: paths as CreationContent['paths'],
  fields: fields as CreationContent['fields'],
  careers: careers as CreationContent['careers'],
  motives: motives as CreationContent['motives'],
  families: families as CreationContent['families'],
  pasts: pasts as CreationContent['pasts'],
};

/** The religious campaign's additions: why this order, and the tie to its province. E3 §4.2–4.3. */
export const religiousCreation = religious as unknown as {
  whys: (CreationOption & { id: WhyOrder })[];
  ties: (CreationOption & { id: ProvinceTie })[];
};
