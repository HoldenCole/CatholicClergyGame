import { useGameStore } from '@/engine/store';
import { deaconOf, returnedVicarOf, seminarianOf } from '@/systems/formed';
import { relationshipWord } from '@/systems/classmates';
import Sheet from '../Sheet';
import Portrait from '../portraits/Portrait';
import { portraitForNpc, yearOf } from '../portraits/spec';
import TalkButton from './TalkButton';

/** The men around him and the men he formed: the seminarian, the deacon, the vicar who came back, and the evaluations written. */
export default function FormedPanel() {
  const game = useGameStore((s) => s.game);
  const evaluate = useGameStore((s) => s.evaluateSeminarian);
  if (!game?.parish) return null;
  const seminarian = seminarianOf(game);
  const deacon = deaconOf(game);
  const vicar = returnedVicarOf(game);
  const formed = game.formed ?? [];
  if (!seminarian && !deacon && !vicar && !formed.length) return null;
  const year = yearOf(game.clock.startDay, game.clock.week);
  const due = !!game.flags['seminarian:evaluation_due'];
  const weeksLeft = game.parish.seminarian ? Math.max(0, game.parish.seminarian.endWeek - game.clock.week) : 0;
  return (
    <Sheet title="The men">
      <ul className="flex flex-col gap-1.5 text-sm">
        {seminarian && (
          <li>
            <div className="flex items-center gap-2">
              <Portrait portrait={portraitForNpc(seminarian, year)} size={22} />
              <span className="min-w-0 flex-1">
                {seminarian.name.first} {seminarian.name.last}, {year - seminarian.birthYear}, seminarian
                <span className="ink-faint block text-xs">{due ? 'Back at the seminary; the rector wants your evaluation.' : `Here for the summer, ${weeksLeft} week${weeksLeft === 1 ? '' : 's'} to go. He has the youth group and the hospital.`}</span>
              </span>
              <span className="ink-muted">{relationshipWord(seminarian.relationship)}</span>
              {!due && <TalkButton npcId={seminarian.id} />}
            </div>
            {due && (
              <div className="ml-7 mt-1 flex flex-wrap items-center gap-1 text-xs">
                <span className="ink-muted">Write the seminary:</span>
                <button className="pbtn px-2 py-0 text-xs" title="A strong report: he should go forward" onClick={() => evaluate('strong')}>strong</button>
                <button className="pbtn px-2 py-0 text-xs" title="Reserved: another year, and watch" onClick={() => evaluate('reserved')}>reserved</button>
                <button className="pbtn px-2 py-0 text-xs" title="Concerned: the rector should know what you saw" onClick={() => evaluate('concerned')}>concerned</button>
              </div>
            )}
          </li>
        )}
        {vicar && (
          <li className="flex items-center gap-2">
            <Portrait portrait={portraitForNpc(vicar, year)} size={22} />
            <span className="min-w-0 flex-1">
              {vicar.title} {vicar.name.first} {vicar.name.last}, parochial vicar
              <span className="ink-faint block text-xs">The seminarian you had, come back a priest. He carries two blocks of the week.</span>
            </span>
            <span className="ink-muted">{relationshipWord(vicar.relationship)}</span>
            <TalkButton npcId={vicar.id} />
          </li>
        )}
        {deacon && (
          <li className="flex items-center gap-2">
            <Portrait portrait={portraitForNpc(deacon, year)} size={22} />
            <span className="min-w-0 flex-1">
              Deacon {deacon.name.first} {deacon.name.last}, {year - deacon.birthYear}
              <span className="ink-faint block text-xs">Permanent deacon: the baptisms, the wakes, the hospital at two in the morning. Half a block of the week back.</span>
            </span>
            <span className="ink-muted">{relationshipWord(deacon.relationship)}</span>
            <TalkButton npcId={deacon.id} />
          </li>
        )}
      </ul>
      {formed.length > 0 && (
        <p className="ink-muted mt-2 text-xs">
          Formed: {formed.map((f) => `${f.name} (${f.year}, ${f.verdict}${f.returned ? ', came back' : ''})`).join('; ')}.
        </p>
      )}
    </Sheet>
  );
}
