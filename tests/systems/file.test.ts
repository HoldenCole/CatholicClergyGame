import { describe, expect, it } from 'vitest';
import { testEvent, testNpc } from '../helpers/fixtures';
import { parishState } from './week.test';
import { FILE, fileLines, fileOf, officialsWrite, readFile, revealFile, writeFile } from '@/systems/file';
import { applyChoice } from '@/engine/events';
import { applyEffects } from '@/engine/effects';
import { revalue } from '@/systems/succession';
import { answerTray, deferMail, mailTrayWeek, MAIL, settleMail } from '@/systems/mail';
import { boardLeavesHim, CAREER, nextAssignment } from '@/engine/career';
import { createRng } from '@/engine/rng';
import { refillDeanery } from '@/systems/deanery';
import type { GameState, Letter } from '@/types';

describe('the file', () => {
  it('is written by the board, the chancellor, a scene, and the officials, and the man sees only what was said to his face', () => {
    let s = parishState('file');
    s = writeFile(s, { by: 'board', byLabel: 'the personnel board', kind: 'decision', text: 'Appointed pastor.', weight: 1, lean: 0, seen: true });
    // A stand taken aloud goes in with its lean.
    const ev = testEvent({ id: 'ev_stand', phase: 'pastor', choices: [{ id: 'a', label: 'Say it from the pulpit', effects: [], volume: 'semi_public', positionTopic: 'liturgy', positionValue: -40 }] });
    s = applyChoice(s, ev, { eventId: ev.id, severity: ev.severity, category: ev.category, week: s.clock.week, bindings: {} }, 'a', () => undefined).state;
    const stand = fileOf(s).find((e) => e.kind === 'position')!;
    expect(stand.lean).toBe(-1);
    expect(stand.seen).toBe(true);
    // A scene writes a note through the effect, unseen.
    s = { ...s, npcs: { ...s.npcs, vfc: testNpc('vfc', { role: 'official', title: 'Msgr.', tags: ['vicar_for_clergy', 'chancery'], relationship: -40 }) } };
    s = applyEffects(s, [{ target: 'file', key: '@x', value: 'Was late to the deanery meeting again.', delta: -1 }], { '@x': 'vfc' });
    const note = fileOf(s).find((e) => e.by === 'vfc')!;
    expect(note.byLabel).toMatch(/Msgr\. Nowak, vicar for clergy/);
    expect(note.seen).toBe(false);
    // The officials write once a year, the cold ones against him.
    const before = fileOf(s).length;
    s = officialsWrite({ ...s, flags: { ...s.flags, ordained: true } });
    expect(fileOf(s).length).toBe(before + 1);
    expect(fileLines(s).hidden).toBe(2);
    expect(fileLines(s).seen.length).toBe(2);
    // A friend reads the last notes out.
    const read = revealFile(s, FILE.revealPerFavour);
    expect(read.revealed.length).toBe(2);
    expect(fileLines(read.state).hidden).toBe(0);
  });

  it('is read by a new bishop: for him or against him by its lean, capped, and the stands left to the reread', () => {
    let s = parishState('read');
    s = writeFile(s, { by: 'board', byLabel: 'board', kind: 'decision', text: 'x', weight: -1, lean: 0 });
    s = writeFile(s, { by: 'x', byLabel: 'x', kind: 'note', text: 'y', weight: 2, lean: 1 });
    s = writeFile(s, { by: 'c', byLabel: 'c', kind: 'position', text: 'z', weight: 3, lean: 1 });
    const left = readFile(s, { alignment: -50 });
    expect(left.count).toBe(2);
    expect(left.swing).toBeCloseTo((-1 + -2) * FILE.readPerWeight, 5);
    const right = readFile(s, { alignment: 50 });
    expect(right.swing).toBeCloseTo((-1 + 2) * FILE.readPerWeight, 5);
    for (let i = 0; i < 20; i++) s = writeFile(s, { by: 'b', byLabel: 'b', kind: 'note', text: `n${i}`, weight: 3, lean: 0 });
    expect(readFile(s, { alignment: 0 }).swing).toBe(FILE.readCap);
    // The succession reads it and says so in the letter.
    const bishop = testNpc('new_bishop', { role: 'bishop', title: 'Bishop', alignment: 0 });
    const withBishop = { ...s, npcs: { ...s.npcs, new_bishop: bishop } };
    const bare = revalue({ ...withBishop, file: [] }, bishop);
    const full = revalue(withBishop, bishop);
    expect(full.state.character!.reputation.chancery).toBeGreaterThan(bare.state.character!.reputation.chancery);
    expect(full.reread.file?.count).toBe(22);
  });
});

describe('the board and age', () => {
  it('leaves a pastor past sixty-five where he is unless he wrote', () => {
    const s = parishState('old', {}, true);
    const young = { ...s, assignment: { ...s.assignment!, role: 'pastor' as const } };
    expect(boardLeavesHim(young)).toBe(false);
    const c = young.character!;
    const old: GameState = { ...young, character: { ...c, entryYear: c.entryYear, background: { ...c.background, entryAge: c.background.entryAge + (CAREER.boardLeavesAt + 2 - 22) } } };
    expect(boardLeavesHim(old)).toBe(true);
    const moved = nextAssignment(old, createRng('board-old'));
    expect(moved.state.assignment!.parishId).toBe(old.assignment!.parishId);
    expect(moved.state.assignment!.reasons.join(' ')).toMatch(/does not move men your age/);
    expect(moved.decisions).toHaveLength(0);
  });
});

describe('mail triage', () => {
  const letter = (s: GameState, npcId?: string): Letter => ({ sort: 'mail', title: 'From your mother', body: ['Come for Sunday.'], week: s.clock.week, mailId: 'm1', from: { ...(npcId ? { npcId } : {}), name: 'your mother', who: 'your mother' }, replies: [{ id: 'yes', label: 'Write back', effects: [], hours: 1 }] });
  it('a letter put aside waits in the tray, is answered from there, or goes to the drawer after a month', () => {
    let s = parishState('tray');
    s = { ...s, npcs: { ...s.npcs, mum: testNpc('mum', { role: 'family', tags: ['mother'], relationship: 50 }) } };
    const l = letter(s, 'mum');
    s = { ...s, mode: { kind: 'letter', letter: l }, mail: [{ mailId: 'm1', week: s.clock.week, from: l.from!, title: l.title, asked: true }] };
    s = deferMail(s);
    expect(s.mode.kind).toBe('clock');
    expect(s.mailTray).toHaveLength(1);
    expect(s.mail![0]!.tray).toBe(true);
    const answered = answerTray(s, 0, 'yes');
    expect(answered.mailTray).toHaveLength(0);
    expect(answered.mail![0]!.replied).toBe('yes');
    expect(answered.npcs['mum']!.relationship).toBe(50);
    // Left too long, the drawer takes it, and the mother remembers.
    const late = mailTrayWeek({ ...s, clock: { ...s.clock, week: s.clock.week + MAIL.trayWeeks } });
    expect(late.mailTray).toHaveLength(0);
    expect(late.npcs['mum']!.relationship).toBe(50 + MAIL.familyUnanswered);
    expect(late.npcs['mum']!.marks?.[0]?.why).toBe('a letter left unanswered');
  });
  it('a stranger left in the drawer costs nothing', () => {
    let s = parishState('drawer');
    const l = letter(s);
    s = { ...s, mail: [{ mailId: 'm1', week: s.clock.week, from: l.from!, title: l.title, asked: true }] };
    const left = settleMail(s, l, null);
    expect(left.digest[left.digest.length - 1]!.lines.some((x) => /left in the drawer/.test(x))).toBe(true);
  });
});

describe('the deanery remembers its seats', () => {
  it('records when each man sat down and who has been dean', () => {
    const s = parishState('seats');
    const d = s.parish!.deanery!;
    expect(Object.keys(d.seats ?? {})).toEqual(expect.arrayContaining(d.priestIds));
    expect(d.deans?.[0]?.npcId).toBe(d.deanId);
    // The dean retires; the senior pastor takes it, and the list grows.
    const dean = s.npcs[d.deanId]!;
    const gone: GameState = { ...s, clock: { ...s.clock, week: s.clock.week + 10 }, npcs: { ...s.npcs, [dean.id]: { ...dean, status: 'retired' } } };
    const next = refillDeanery(gone);
    const nd = next.parish!.deanery!;
    expect(nd.deanId).not.toBe(dean.id);
    expect(nd.deans).toHaveLength(2);
    expect(nd.deans![1]!.week).toBe(gone.clock.week);
  });
});
