import type { OfferDef } from '@/types';

interface OfferFile {
  _notes?: string;
  offers: OfferDef[];
}

const modules = import.meta.glob<{ default: OfferFile }>('./*.json', { eager: true });

export const allOffers: OfferDef[] = Object.keys(modules)
  .sort()
  .flatMap((path) => modules[path]!.default.offers);

const byId = new Map(allOffers.map((o) => [o.id, o]));

export function offerById(id: string): OfferDef | undefined {
  return byId.get(id);
}

export function offersForPhase(phase: OfferDef['phase'][number]): OfferDef[] {
  return allOffers.filter((o) => o.phase.includes(phase));
}

export const offerFiles: Record<string, OfferFile> = Object.fromEntries(
  Object.entries(modules).map(([path, m]) => [path, m.default]),
);
