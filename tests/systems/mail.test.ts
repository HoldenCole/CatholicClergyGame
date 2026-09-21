import { describe, expect, it } from 'vitest';
import { parishState } from './week.test';
import { createRng } from '@/engine/rng';
import { answerMail, composeMail, eligibleMail, findSender, MAIL, MAIL_FROM, mailDefs, mailWeek, mailbag } from '@/systems/mail';
import { parishWeekHook } from '@/engine/weekHook';
import type { GameState } from '@/types';

/** The fixture has no classmates; a life with letters in it needs a few, and one who left. */
function withClassmates(s: GameState): GameState {
  const base = Object.values(s.npcs).find((n) => n.role === 'lay')!;
  const mk = (id: string, status: 'active' | 'left', tags: string[]) => ({ ...base, id, role: 'classmate' as const, status, title: status === 'active' ? 'Fr.' : '', tags, relationship: 20, bonds: [] });
  const mother = { ...base, id: 'mother', role: 'family' as const, status: 'active' as const, title: '', tags: ['mother'], relationship: 40, bonds: [] };
  return { ...s, npcs: { ...s.npcs, cm1: mk('cm1', 'active', ['pastor', 'rome_alumnus']), cm2: mk('cm2', 'active', []), cm3: mk('cm3', 'left', []), ...(s.npcs.mother ? {} : { mother }) } };
}

const KNOWN_TOKENS = new Set(['sender', 'sender_first', 'who', 'bond', 'former_parish', 'years', 'post', 'parish', 'town', 'diocese', 'first_name', 'name', 'surname']);
const TARGETS = new Set(['relationship', 'reputation', 'stat', 'strain', 'flag', 'bond', 'town', 'known', 'money']);

describe('the mailbag', () => {
  it('the letters are well-formed: known senders, tokens, targets, replies', () => {
    expect(mailDefs.length).toBeGreaterThanOrEqual(12);
    const ids = new Set<string>();
    for (const d of mailDefs) {
      expect(ids.has(d.id)).toBe(false); ids.add(d.id);
      expect(MAIL_FROM).toContain(d.from);
      expect(d.replies.length).toBeGreaterThanOrEqual(2);
      expect(d.suppressYears).toBeGreaterThanOrEqual(1);
      for (const t of (d.title + ' ' + d.body.join(' ')).matchAll(/\{(@?[a-z_:0-9]+)\}/g)) {
        const tok = t[1]!;
        expect(KNOWN_TOKENS.has(tok) || tok.startsWith('town:'), `${d.id} token ${tok}`).toBe(true);
      }
      const rids = new Set(d.replies.map((r) => r.id));
      expect(rids.size).toBe(d.replies.length);
      for (const r of d.replies) for (const e of r.effects) expect(TARGETS.has(e.target), `${d.id}/${r.id} ${e.target}`).toBe(true);
    }
  });

  it('finds senders from the man’s own life, and none where his life holds no such person', () => {
    const s = withClassmates(parishState('mail-senders'));
    const rng = createRng('s');
    expect(findSender(s, 'parishioner', rng)?.sender.npcId).toBeTruthy();
    expect(findSender(s, 'classmate', rng)?.sender.name).toMatch(/^Fr\. /);
    expect(findSender(s, 'classmate_left', rng)?.sender.who).toBe('who left');
    expect(findSender(s, 'mother', rng)?.sender.name).toBe('your mother');
    const stranger = findSender(s, 'stranger', createRng('x'))!;
    expect(stranger.sender.npcId).toBeUndefined();
    expect(stranger.sender.name.split(' ').length).toBeGreaterThanOrEqual(2);
    expect(findSender(s, 'stranger', createRng('x'))).toEqual(stranger);
    // No previous parish, no buried bond old enough, no seminarian: no letter of those kinds.
    expect(findSender(s, 'former_parish', rng)).toBeNull();
    expect(findSender(s, 'buried', rng)).toBeNull();
    expect(findSender(s, 'seminarian_mother', rng)).toBeNull();
    // A burial ten years old finds its writer.
    const npc = Object.values(s.npcs).find((n) => n.role === 'lay' && n.tags.includes('parishioner'))!;
    const old: GameState = { ...s, clock: { ...s.clock, week: s.clock.week + 52 * 10 }, npcs: { ...s.npcs, [npc.id]: { ...npc, bonds: [{ kind: 'buried', who: 'her husband', week: s.clock.week }] } } };
    const buried = findSender(old, 'buried', rng)!;
    expect(buried.sender.npcId).toBe(npc.id);
    expect(buried.extra.years).toBe('10');
    expect(buried.sender.who).toBe('whose husband you buried');
    // A former parish, through the tenures.
    const other = s.world!.parishes.find((p) => p.id !== s.assignment!.parishId)!;
    const former: GameState = { ...s, tenures: [{ kind: 'parish', label: 'Parochial vicar', place: other.name, role: 'parochial_vicar', parishId: other.id, startWeek: 0, endWeek: 100, left: 'moved' }], npcs: { ...s.npcs, ghost: { ...npc, id: 'ghost', tags: [`parish:${other.id}`, 'parishioner'] } } };
    const f = findSender(former, 'former_parish', rng)!;
    expect(f.sender.npcId).toBe('ghost');
    expect(f.extra.former_parish).toBe(other.name);
  });

  it('letters come a few times a year, rendered whole, recorded, and not the same one twice too soon', () => {
    const plain = withClassmates(parishState('mail-weeks'));
    // A life with a past in it: a burial ten years back, a former parish, a public name.
    const npc = Object.values(plain.npcs).find((n) => n.role === 'lay' && n.tags.includes('parishioner'))!;
    const other = plain.world!.parishes.find((p) => p.id !== plain.assignment!.parishId)!;
    const s: GameState = {
      ...plain,
      npcs: { ...plain.npcs, [npc.id]: { ...npc, bonds: [{ kind: 'buried', who: 'her husband', week: plain.clock.week - 52 * 10 }] }, ghost: { ...npc, id: 'ghost', tags: [`parish:${other.id}`, 'parishioner'], bonds: [] } },
      tenures: [{ kind: 'parish', label: 'Parochial vicar', place: other.name, role: 'parochial_vicar', parishId: other.id, startWeek: 0, endWeek: 100, left: 'moved' }],
      character: { ...plain.character!, reputation: { ...plain.character!.reputation, public: 20 } },
    };
    let next: GameState = s;
    const seen: string[] = [];
    for (let w = 1; w <= 52 * 6; w++) {
      const at: GameState = { ...next, clock: { ...next.clock, week: s.clock.week + w }, mode: { kind: 'clock' }, letterQueue: [] };
      const r = mailWeek(at, createRng(`m${w}`));
      if (r.letterQueue?.length) {
        const l = r.letterQueue[0]!;
        expect(l.sort).toBe('mail');
        expect(l.from?.name).toBeTruthy();
        expect(l.replies?.length).toBeGreaterThan(1);
        expect(l.body.join(' ')).not.toMatch(/\{[@\w:]+\}/);
        expect(l.title).not.toMatch(/\{/);
        seen.push(l.mailId!);
        expect(r.mail?.at(-1)?.mailId).toBe(l.mailId);
        expect(r.flags[`mail:${l.mailId}`]).toBe(at.clock.week);
      }
      next = { ...r, letterQueue: [] };
    }
    expect(seen.length).toBeGreaterThanOrEqual(8);
    expect(seen.length).toBeLessThanOrEqual(30);
    expect(new Set(seen).size).toBeGreaterThan(3);
    // Suppression: the same letter never twice inside its years.
    const weeks: Record<string, number[]> = {};
    for (const m of next.mail ?? []) (weeks[m.mailId] ??= []).push(m.week);
    for (const [id, ws] of Object.entries(weeks)) {
      const years = mailDefs.find((d) => d.id === id)!.suppressYears;
      for (let i = 1; i < ws.length; i++) expect(ws[i]! - ws[i - 1]!).toBeGreaterThanOrEqual(years * 52);
    }
    // The gap between letters holds.
    const all = (next.mail ?? []).map((m) => m.week);
    for (let i = 1; i < all.length; i++) expect(all[i]! - all[i - 1]!).toBeGreaterThanOrEqual(MAIL.gapWeeks);
    expect(mailbag(next)[0]!.week).toBe(Math.max(...all));
  });

  it('answering applies the reply with the sender bound and costs the hours; leaving it is recorded too', () => {
    const s = parishState('mail-answer');
    const found = findSender(s, 'parishioner', createRng('f'))!;
    const def = mailDefs.find((d) => d.id === 'ml_parishioner_thanks')!;
    const letter = composeMail(s, def, found);
    const onDesk: GameState = { ...s, mode: { kind: 'letter', letter }, mail: [{ mailId: def.id, week: s.clock.week, from: found.sender, title: letter.title, asked: false }] };
    const before = s.npcs[found.sender.npcId!]!.relationship;
    const answered = answerMail(onDesk, 'write_back');
    expect(answered.mode.kind).toBe('clock');
    expect(answered.npcs[found.sender.npcId!]!.relationship).toBe(before + 8);
    expect(answered.parish!.apNextWeek).toBeCloseTo(s.parish!.apNextWeek - 0.25, 5);
    expect(answered.mail![0]!.replied).toBe('write_back');
    expect(answered.mail![0]!.repliedLabel).toMatch(/Write back/);
    expect(answered.career.at(-1)?.text).toMatch(/^Answered /);
    expect(answered.digest.flatMap((d) => d.lines).some((l) => l.startsWith(letter.title + ': '))).toBe(true);
    const left = answerMail(onDesk, null);
    expect(left.mode.kind).toBe('clock');
    expect(left.npcs[found.sender.npcId!]!.relationship).toBe(before);
    expect(left.mail![0]!.replied).toBeUndefined();
    expect(left.digest.flatMap((d) => d.lines).some((l) => /left in the drawer/.test(l))).toBe(true);
    // Not a mail letter: nothing happens.
    const review: GameState = { ...s, mode: { kind: 'letter', letter: { sort: 'review', title: 'x', body: [], week: 0 } } };
    expect(answerMail(review, 'write_back')).toBe(review);
    // Eligible letters all have a sender and pass their conditions.
    for (const e of eligibleMail(s, createRng('e'))) expect(e.found.sender.name).toBeTruthy();
  });

  it('the parish week delivers a letter through the hook, and it stops the clock as a letter', () => {
    const s = parishState('mail-hook');
    const deps = { pool: [], draw: () => [] } as never;
    let delivered = false;
    for (let w = 5; w < 300 && !delivered; w++) {
      const r = parishWeekHook(deps)({ ...s, clock: { ...s.clock, week: s.clock.week + w }, mode: { kind: 'clock' } }, createRng(`h${w}`), []);
      if (r.mode.kind === 'letter' && r.mode.letter.sort === 'mail') delivered = true;
    }
    expect(delivered).toBe(true);
  });
});
