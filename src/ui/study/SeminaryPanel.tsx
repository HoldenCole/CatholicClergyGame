import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { seminaryPools } from '@/content/see';
import { ordinal, SEMINARY } from '@/systems/bishop/seminary';
import { priestsOfSee, shortName } from '@/systems/bishop/directions';
import { PILLARS, type Pillar, type SeminaryWhere } from '@/types';
import Sheet from '../Sheet';

const WHERES: SeminaryWhere[] = ['own', 'province', 'rome'];

/** The seminary: where the men are formed, what is stressed, the rector and the vocations director, the applicants, and the men. E4 R1.4. */
export default function SeminaryPanel() {
  const game = useGameStore((s) => s.game);
  const act = useGameStore((s) => s.seminaryAct);
  const [rector, setRector] = useState('');
  const [director, setDirector] = useState('');
  const sem = game?.see?.seminary;
  if (!game || !sem) return null;
  const own = game.world?.diocese.visible.institutions.includes('major_seminary') ?? false;
  const priests = priestsOfSee(game);
  const men = sem.men.filter((m) => m.status === 'forming').sort((a, b) => b.year - a.year);
  const word = (v: number) => (v < 40 ? 'weak' : v < 70 ? 'sound' : 'strong');
  return (
    <Sheet title={`The seminary: ${sem.name}`}>
      <div className="flex flex-wrap gap-1 text-xs">
        {WHERES.map((w) => (
          <button key={w} className={'pbtn px-2 py-0.5 text-xs ' + (sem.where === w ? 'pbtn-primary' : '')} disabled={w === 'own' && !own} title={w === 'own' && !own ? 'The see has no seminary of its own.' : seminaryPools.where[w].blurb} onClick={() => act({ kind: 'where', where: w })}>{seminaryPools.where[w].label}</button>
        ))}
      </div>
      <p className="ink-muted mt-1 text-xs">{seminaryPools.where[sem.where].blurb}</p>
      <div className="mt-2 flex flex-wrap gap-1 text-xs">
        {PILLARS.map((p: Pillar) => (
          <button key={p} className={'pbtn px-2 py-0.5 text-xs ' + (sem.emphasis === p ? 'pbtn-primary' : '')} title={seminaryPools.emphasis[p].blurb} onClick={() => act({ kind: 'emphasis', pillar: p })}>{seminaryPools.emphasis[p].label}</button>
        ))}
      </div>
      <p className="ink-muted mt-1 text-xs">{seminaryPools.emphasis[sem.emphasis].blurb}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {sem.where === 'own' && (
          <div className="flex items-center justify-between gap-2"><dt className="ink-muted">Rector</dt><dd className="flex items-center gap-1">{sem.rectorId && game.npcs[sem.rectorId] ? shortName(game.npcs[sem.rectorId]!) : 'none'}
            <select className="pinput text-xs" value={rector} onChange={(e) => setRector(e.target.value)}><option value="">name…</option>{priests.map((n) => <option key={n.id} value={n.id}>{shortName(n)}</option>)}</select>
            <button className="pbtn px-1 text-xs" disabled={!rector} onClick={() => { act({ kind: 'rector', npcId: rector }); setRector(''); }}>Name</button></dd></div>
        )}
        <div className="flex items-center justify-between gap-2"><dt className="ink-muted">Vocations</dt><dd className="flex items-center gap-1">{sem.vocationsDirectorId && game.npcs[sem.vocationsDirectorId] ? shortName(game.npcs[sem.vocationsDirectorId]!) : 'none'}
          <select className="pinput text-xs" value={director} onChange={(e) => setDirector(e.target.value)}><option value="">name…</option>{priests.map((n) => <option key={n.id} value={n.id}>{shortName(n)}</option>)}</select>
          <button className="pbtn px-1 text-xs" disabled={!director} onClick={() => { act({ kind: 'director', npcId: director }); setDirector(''); }}>Name</button></dd></div>
      </dl>
      {sem.applicants.length > 0 && (
        <>
          <p className="mt-3 text-sm">Applicants</p>
          <ul className="flex flex-col gap-1 text-xs">
            {sem.applicants.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-2"><span>{a.line}</span><span className="flex shrink-0 gap-1"><button className="pbtn pbtn-primary px-2 py-0.5 text-xs" onClick={() => act({ kind: 'admit', applicantId: a.id, yes: true })}>Admit</button><button className="pbtn px-2 py-0.5 text-xs" onClick={() => act({ kind: 'admit', applicantId: a.id, yes: false })}>Decline</button></span></li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-3 text-sm">In formation{men.length ? '' : ': nobody'}</p>
      <ul className="flex flex-col gap-1 text-xs">
        {men.map((m) => (
          <li key={m.id}>
            <span>{m.name}, {ordinal(m.year)} year{m.rome !== undefined ? ', in Rome' : ''}{m.delayed ? ', held' : ''}: {PILLARS.map((p) => `${p} ${word(m.pillars[p])}`).join(', ')}{m.issueSeen ? `; ${seminaryPools.issues[m.issue!]?.label}` : ''}.</span>
            <span className="ml-2 inline-flex gap-1">
              <button className="pbtn px-1 text-xs" disabled={!!m.delayed} onClick={() => act({ kind: 'delay', manId: m.id })}>Hold a year</button>
              <button className="pbtn px-1 text-xs" disabled={m.rome !== undefined || m.year < SEMINARY.romeFromYear} onClick={() => act({ kind: 'rome', manId: m.id })}>Rome</button>
              <button className="pbtn px-1 text-xs" onClick={() => act({ kind: 'dismiss', manId: m.id })}>Dismiss</button>
            </span>
          </li>
        ))}
      </ul>
      {sem.ordainedIds.length > 0 && <p className="ink-muted mt-2 text-xs">Ordained from it in this chair: {sem.ordainedIds.map((id) => game.npcs[id]).filter(Boolean).map((n) => shortName(n!)).join(', ')}.</p>}
    </Sheet>
  );
}
