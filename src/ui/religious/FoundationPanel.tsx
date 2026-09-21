import { useState } from 'react';
import { useGameStore } from '@/engine/store';
import { charterDials, foundationWorkDefs, religiousOrder } from '@/content/religious';
import { canPetition, foundationSites, mostNeededWorks, provinceScore, spareMen, workLabel, workNeeds, FOUNDING } from '@/systems/religious/founding';
import { CHARTER_DIALS, charterFactors, dialLabel, optionAllowed, optionIdOf } from '@/systems/religious/charter';
import DialRow from './DialRow';
import { canSendDaughter, expectedVocations, heirsOf, myFoundation } from '@/systems/religious/foundationYear';
import { membersOf } from '@/systems/religious/house';
import { reputationDef, reputationWord } from '@/systems/religious/reputations';
import { worldOf } from '@/systems/religious/transfer';
import type { CharterWork, Foundation, FoundationSite } from '@/types';
import Sheet from '../Sheet';

const WORKS: CharterWork[] = ['preaching', 'teaching', 'study', 'parish', 'evangelization', 'poor_relief', 'retreats', 'chaplaincy', 'media'];

function needWord(n: number): string {
  return ['', 'comfortable', 'well served', 'stretched', 'short', 'desperate'][n] ?? '';
}
function warmthWord(w: number): string {
  return w >= 25 ? 'warm to the order' : w >= 5 ? 'would hear it' : w >= FOUNDING.bishopConsentAt ? 'cool' : 'would not sign';
}

/**
 * The foundation sheet. E3 §9: the province's territory as places to
 * found, sortable by state and city, with the need first; the petition
 * and its answer; then the house itself, developed over decades.
 */
export default function FoundationPanel() {
  const game = useGameStore((s) => s.game);
  const petition = useGameStore((s) => s.petitionFoundation);
  const answerAsk = useGameStore((s) => s.answerFoundationAsk);
  const addWork = useGameStore((s) => s.addFoundationWork);
  const revise = useGameStore((s) => s.reviseFoundation);
  const send = useGameStore((s) => s.sendDaughter);
  const [sort, setSort] = useState<'need' | 'state' | 'city'>('need');
  const [chosen, setChosen] = useState<string | null>(null);
  const [work, setWork] = useState<CharterWork>('preaching');
  const [heir, setHeir] = useState<string | null>(null);
  const [where, setWhere] = useState<string | null>(null);
  if (!game?.religious || !game.character) return null;
  const r = game.religious;
  const order = religiousOrder(r.order);
  const title = order.governance.provincialTitle;
  const mine = myFoundation(game);
  const line = r.foundationLine;
  const pet = r.petition;
  const sites = foundationSites(game);
  const sorted = [...sites].sort((a, b) => (sort === 'need' ? b.need - a.need || a.see.localeCompare(b.see) : sort === 'state' ? a.region.localeCompare(b.region) || a.see.localeCompare(b.see) : a.see.localeCompare(b.see)));
  const can = canPetition(game);
  const picked = sites.find((s) => s.dioceseId === chosen);
  const score = picked ? provinceScore(game, { dioceseId: picked.dioceseId, work, kind: 'petition' }) : 0;
  const foundations = r.foundations ?? [];
  const picksNeeds = chosen ? workNeeds(game, chosen) : undefined;
  const picksMost = chosen ? mostNeededWorks(game, chosen) : [];
  // A work the diocese already has from the order cannot be petitioned for: the choice falls to the most needed open one.
  const openWorks = picksNeeds ? WORKS.filter((w) => !picksNeeds[w].filled) : WORKS;
  const effectiveWork: CharterWork = picksNeeds && picksNeeds[work].filled ? (picksMost[0] ?? openWorks[0] ?? work) : work;

  return (
    <>
      {line && <Sheet title="The foundation"><p className="text-sm italic leading-relaxed">{line}</p></Sheet>}

      {pet && !pet.outcome && (
        <Sheet title={pet.kind === 'asked' ? `The ${title} asks` : 'The petition'}>
          <p className="text-sm leading-relaxed">
            {pet.kind === 'asked' ? `The ${title} has asked you to lead a house in ${worldOf(game, pet.dioceseId)?.diocese.visible.name ?? 'the diocese'}, for ${workLabel(pet.work)}. The province is behind it; the bishop's letter is being sought.` : `Before the chapter: a house in ${worldOf(game, pet.dioceseId)?.diocese.visible.name ?? 'the diocese'}, for ${workLabel(pet.work)}. The province votes first; the bishop signs second, or does not. An answer in about ${FOUNDING.answerWeeks} weeks; ${Math.max(0, FOUNDING.answerWeeks - (game.clock.week - pet.week))} to go.`}
          </p>
          {pet.kind === 'asked' && (
            <div className="mt-2 flex gap-2">
              <button className="pbtn pbtn-primary px-2 py-0.5 text-xs" onClick={() => answerAsk(true)}>Take it up</button>
              <button className="pbtn px-2 py-0.5 text-xs" onClick={() => answerAsk(false)}>Say no, and be remembered for it</button>
            </div>
          )}
        </Sheet>
      )}

      {mine && <HouseSheet game={game} f={mine} addWork={addWork} revise={revise} heir={heir} setHeir={setHeir} where={where} setWhere={setWhere} send={send} sites={sites} />}

      {foundations.filter((f) => f.houseId !== mine?.houseId).length > 0 && (
        <Sheet title="The houses of your line">
          <ul className="flex flex-col gap-1.5 text-sm">
            {foundations.filter((f) => f.houseId !== mine?.houseId).map((f) => {
              const h = game.orderHouses?.[f.houseId];
              const men = h ? membersOf(game, h).length : 0;
              const years = Math.floor((game.clock.week - f.foundedWeek) / 52);
              return (
                <li key={f.houseId}>
                  <span className="font-medium">{h?.name ?? 'A house'}</span> <span className="ink-muted">· {worldOf(game, f.dioceseId)?.diocese.visible.name ?? f.dioceseId} · {years} year{years === 1 ? '' : 's'}{f.daughterOf ? ` · a daughter house under ${game.npcs[f.heirId ?? '']?.name.last ?? 'an heir'}` : ''}</span>
                  {f.status === 'failed' ? <span className="ink-wine"> · closed: {f.failedWhy}.</span> : <span className="ink-faint text-xs"> · {men} men · {f.vocationIds.length} came through it{f.revisions.length ? ` · charter revised ${f.revisions.length} time${f.revisions.length === 1 ? '' : 's'}: ${f.revisions.map((v) => `${dialLabel(v.dial).toLowerCase()} ${v.to.replace(/_/g, ' ')}`).join(', ')}` : ' · the charter as you wrote it'}</span>}
                </li>
              );
            })}
          </ul>
        </Sheet>
      )}

      {!mine && (!pet || pet.outcome) && !r.charterDraft && (
        <Sheet title="Where a house could go">
          <p className="ink-muted text-xs leading-relaxed">
            The province&rsquo;s territory, read from the dioceses as they are. The need is the number to read first: a province says yes to a thin plan in a desperate place and no to a strong one in a comfortable one. Two keys turn or do not: the province must send men, and the bishop must consent in writing. Failure is normal, especially early; a refused petition files the idea, and the second try scores higher.
          </p>
          <div className="mt-2 flex gap-1 text-xs">
            <span className="ink-faint">Sort by</span>
            {(['need', 'state', 'city'] as const).map((k) => <button key={k} className={'pbtn px-2 py-0 text-xs ' + (sort === k ? 'pbtn-primary' : '')} onClick={() => setSort(k)}>{k}</button>)}
          </div>
          <table className="mt-2 w-full text-xs">
            <thead><tr className="ink-faint text-left"><th>Place</th><th>Need</th><th>Bishop</th><th>Order here</th><th>University</th><th>Catholics</th><th>Cost</th></tr></thead>
            <tbody>
              {sorted.map((s: FoundationSite) => (
                <tr key={s.dioceseId} className={'cursor-pointer ' + (chosen === s.dioceseId ? 'bg-white/40' : '')} onClick={() => setChosen(s.dioceseId)}>
                  <td className="py-0.5">{s.see}<span className="ink-faint"> · {s.region}</span></td>
                  <td>{'●'.repeat(s.need)}{'○'.repeat(5 - s.need)} <span className="ink-faint">{needWord(s.need)}{s.invited ? ' · invited' : ''}</span></td>
                  <td>{warmthWord(s.bishop)}</td>
                  <td>{s.presence}{s.others ? <span className="ink-faint"> · {s.others} other{s.others === 1 ? '' : 's'}</span> : ''}</td>
                  <td>{s.university ? 'yes' : '—'}</td>
                  <td>{s.climate >= 65 ? 'young' : s.climate >= 40 ? 'mixed' : 'aging'}</td>
                  <td>${Math.round(s.cost / 1000)}k</td>
                </tr>
              ))}
            </tbody>
          </table>
          {picked && (
            <div className="mt-3 rounded border rule bg-white/30 p-3 text-sm">
              <div className="font-medium">{picked.name}</div>
              {picked.lines.map((l, i) => <p key={i} className="ink-muted text-xs leading-relaxed">{l}</p>)}
              <div className="mt-2 flex flex-wrap gap-1">
                {WORKS.map((w) => {
                  const n = picksNeeds?.[w];
                  return <button key={w} className={'pbtn px-2 py-0 text-xs ' + (effectiveWork === w ? 'pbtn-primary ' : '') + (picksMost.includes(w) && effectiveWork !== w ? 'ring-1 ring-[#7a1f1f]/60' : '')} disabled={!!n?.filled} title={n?.filled ? n.why : n ? `${'●'.repeat(n.need)}${'○'.repeat(3 - n.need)} needed here` : ''} onClick={() => setWork(w)}>{charterDials.primaryWork.find((o) => o.id === w)?.label}{n && !n.filled && n.need > 0 ? <span className="ink-faint ml-1">{'●'.repeat(n.need)}</span> : ''}{picksMost.includes(w) ? <span className="ink-wine ml-1">· needed</span> : ''}</button>;
                })}
              </div>
              <p className="ink-faint mt-2 text-xs">
                As the province would read it now: {score >= 0.7 ? 'likely' : score >= 0.5 ? 'an even chance' : score >= 0.35 ? 'unlikely' : 'no'}; the bishop {warmthWord(picked.bishop)}. {spareMen(game) < FOUNDING.spare ? 'The province has no men to send, whatever it thinks of you.' : ''} {game.province && game.province.finances.retirementBurden > game.province.finances.balance ? 'The province is in retirement debt.' : ''}
              </p>
              {can.ok ? (
                <button className="pbtn pbtn-primary mt-2 px-2 py-0.5 text-xs" disabled={openWorks.length === 0} onClick={() => { petition(picked.dioceseId, effectiveWork); setChosen(null); }}>Petition the chapter{openWorks.length === 0 ? ': nothing the order does not already do here' : ''}</button>
              ) : (
                <p className="ink-faint mt-2 text-xs">{can.why}</p>
              )}
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}

function HouseSheet({ game, f, addWork, revise, heir, setHeir, where, setWhere, send, sites }: { game: NonNullable<ReturnType<typeof useGameStore.getState>['game']>; f: Foundation; addWork: (id: string) => void; revise: (dial: never, to: string) => void; heir: string | null; setHeir: (id: string | null) => void; where: string | null; setWhere: (id: string | null) => void; send: (heirId: string, dioceseId: string) => void; sites: FoundationSite[] }) {
  const house = game.orderHouses?.[f.houseId];
  if (!house) return null;
  const members = membersOf(game, house);
  const years = Math.floor((game.clock.week - f.foundedWeek) / 52);
  const factors = charterFactors(f.charter);
  const expected = expectedVocations(game, f);
  const heirs = heirsOf(game, f);
  const daughter = canSendDaughter(game, f);
  const reps = (Object.entries(f.reputations) as [keyof typeof f.reputations, number][]).filter(([, v]) => v >= 15).sort((a, b) => b[1] - a[1]);
  return (
    <Sheet title={house.name}>
      <p className="text-sm leading-relaxed">
        Founded {years === 0 ? 'this year' : `${years} year${years === 1 ? '' : 's'} ago`} in {worldOf(game, f.dioceseId)?.diocese.visible.name ?? 'the diocese'}. {members.length + 1} men, {f.vocationIds.length} of whom came to the order through this house. {expected >= 1.2 ? 'Vocations come every year.' : expected >= 0.6 ? 'A vocation most years.' : expected >= 0.3 ? 'A vocation now and then.' : 'Almost no vocations of its own.'} The house holds {f.budget < 0 ? 'less than nothing: it is in debt' : `$${Math.round(f.budget / 1000)}k`}.
      </p>
      {reps.length > 0 && <p className="ink-muted mt-1 text-xs">Known as {reps.map(([k, v]) => `the house of the ${reputationDef(k).label.toLowerCase()} (${reputationWord(v)})`).join(', ')}.</p>}
      <div className="mt-2">
        <div className="heading text-sm">The charter</div>
        <div className="mt-1 flex flex-col gap-1 text-xs">
          {CHARTER_DIALS.map((dial) => (
            <DialRow key={dial} dial={dial} compact current={optionIdOf(f.charter, dial)} allowed={(id) => optionAllowed(game, dial, id, f.dioceseId, f.charter)} onPick={(id) => revise(dial as never, id)} needs={dial === 'primaryWork' || dial === 'secondaryWork' || dial === 'tertiaryWork' ? workNeeds(game, f.dioceseId) : undefined} most={mostNeededWorks(game, f.dioceseId)} />
          ))}
        </div>
        <p className="ink-faint mt-1 text-xs">Revising a dial is the prior&rsquo;s to do, and it is remembered against your name{factors.friction.progressive + factors.friction.observant > 0 ? '; the house sits at odds with part of the province as written' : ''}.</p>
        {f.revisions.length > 0 && <p className="ink-muted mt-1 text-xs">Revised: {f.revisions.map((v) => `${dialLabel(v.dial).toLowerCase()} to ${v.to.replace(/_/g, ' ')} (${v.by === 'player' ? 'you' : game.npcs[v.by]?.name.last ?? 'a successor'})`).join('; ')}.</p>}
      </div>
      <div className="mt-2">
        <div className="heading text-sm">Works</div>
        <ul className="mt-1 flex flex-col gap-1 text-xs">
          {foundationWorkDefs.map((w) => {
            const has = f.works.includes(w.id);
            const uni = !w.needsUniversity || worldOf(game, f.dioceseId)?.diocese.visible.institutions.includes('catholic_university');
            const ok = !has && members.length + 1 >= w.men && f.budget >= w.cost && uni;
            return (
              <li key={w.id} className="flex items-start justify-between gap-2">
                <span className={has ? '' : 'ink-muted'}><span className="font-medium">{w.label}</span> <span className="ink-faint">· {w.men} men · ${Math.round(w.cost / 1000)}k</span><br /><span className="ink-faint">{w.line}</span></span>
                {has ? <span className="ink-faint shrink-0">open</span> : ok ? <button className="pbtn shrink-0 px-2 py-0 text-xs" onClick={() => addWork(w.id)}>Open it</button> : <span className="ink-faint shrink-0 text-right">{!uni ? 'no university here' : members.length + 1 < w.men ? `${w.men - members.length - 1} more men` : 'not the money'}</span>}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mt-2">
        <div className="heading text-sm">A daughter house</div>
        <p className="ink-muted text-xs leading-relaxed">At {factors.daughterAt} men the house can send out a foundation of its own, under one of the men formed here. You are choosing an heir: the daughter house inherits his reading of the charter, not yours.</p>
        {daughter.ok ? (
          <div className="mt-1 flex flex-col gap-1 text-xs">
            <div className="flex flex-wrap gap-1">{heirs.map((h) => <button key={h.id} className={'pbtn px-2 py-0 text-xs ' + (heir === h.id ? 'pbtn-primary' : '')} onClick={() => setHeir(h.id)}>{h.title} {h.name.first} {h.name.last}{h.alignment - f.charter.alignment > 25 ? ' · looser than you' : h.alignment - f.charter.alignment < -25 ? ' · stricter than you' : ''}</button>)}</div>
            <div className="flex flex-wrap gap-1">{sites.filter((s) => s.dioceseId !== f.dioceseId).sort((a, b) => b.need - a.need).slice(0, 6).map((s) => <button key={s.dioceseId} className={'pbtn px-2 py-0 text-xs ' + (where === s.dioceseId ? 'pbtn-primary' : '')} onClick={() => setWhere(s.dioceseId)}>{s.see} · {needWord(s.need)}</button>)}</div>
            <button className="pbtn pbtn-primary self-start px-2 py-0.5 text-xs" disabled={!heir || !where} onClick={() => { if (heir && where) send(heir, where); }}>Send them out</button>
          </div>
        ) : (
          <p className="ink-faint mt-1 text-xs">{daughter.why}</p>
        )}
      </div>
    </Sheet>
  );
}
