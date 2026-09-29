import raw from './dioceses/metropolias.json';

/** One see of a province as the data names it. */
export interface MetropoliaSeeDef {
  see: string;
  state: string;
  aliases?: string[];
}

export interface MetropoliaDef {
  id: string;
  name: string;
  metropolitan: MetropoliaSeeDef;
  suffragans: MetropoliaSeeDef[];
}

/** The Latin-rite provinces of the United States as data. E2 §2.1, decision A; flagged to verify. */
export const metropoliaDefs: MetropoliaDef[] = (raw as { provinces: MetropoliaDef[] }).provinces;

function named(def: MetropoliaSeeDef, see: string, state?: string): boolean {
  const names = [def.see, ...(def.aliases ?? [])];
  return names.includes(see) && (!state || def.state === state);
}

/** The province a see city sits in, and its rank there; the state tells Portland from Portland. */
export function metropoliaOfSee(see: string, state?: string): { def: MetropoliaDef; rank: 'metropolitan' | 'suffragan' } | undefined {
  const exact = (withState: boolean) => {
    for (const def of metropoliaDefs) {
      if (named(def.metropolitan, see, withState ? state : undefined)) return { def, rank: 'metropolitan' as const };
      if (def.suffragans.some((s) => named(s, see, withState ? state : undefined))) return { def, rank: 'suffragan' as const };
    }
    return undefined;
  };
  return exact(true) ?? exact(false);
}

export function metropoliaById(id: string): MetropoliaDef | undefined {
  return metropoliaDefs.find((d) => d.id === id);
}
