"use client";

import { GAMES, VERIFIED_GAMES, type GameId } from "@/lib/games";
import { PALETTE_LIST, type TargetPalette } from "@/lib/palettes";
import { SCENARIOS } from "@/lib/scenario";
import { checkSens, cm360, edpi } from "@/lib/sens";
import { useSettings, type Grip } from "@/store/settings";
import { DpiCheck } from "@/components/aim/DpiCheck";
import { TravelMeter } from "@/components/aim/TravelMeter";
import {
  ArrowRight,
  ButtonLink,
  Card,
  CardHeader,
  ChoiceGroup,
  Disclosure,
  Eyebrow,
  NumberInput,
  SelectInput,
  SwitchRow,
} from "@/components/ui";

const GRIPS: { id: Grip; label: string; hint: string }[] = [
  { id: "arm", label: "Arm", hint: "Elbow and shoulder" },
  { id: "hybrid", label: "Hybrid", hint: "Arm plus wrist" },
  { id: "wrist", label: "Wrist", hint: "Wrist and fingers" },
];

export function SetupForm() {
  const s = useSettings();
  const game = GAMES[s.gameId];

  const cm = cm360(s.gameId, s.sens, s.dpi);
  const sanity = checkSens({ cm360: cm, padWidthCm: s.padWidthCm });

  return (
    <div className="mt-12 space-y-3">
      <Card>
        <CardHeader title="Your setup" />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectInput
            label="Game"
            value={s.gameId}
            onChange={(id: GameId) => {
              s.setGame(id);
              s.setSens(GAMES[id].defaultSens);
            }}
            options={VERIFIED_GAMES.map((g) => ({ value: g.id, label: g.name }))}
          />

          <NumberInput
            label="Mouse DPI"
            value={s.dpi}
            onChange={s.setDpi}
            min={100}
            max={32000}
            step={50}
            largeStep={400}
          />

          <NumberInput
            label="In-game sensitivity"
            value={s.sens}
            onChange={s.setSens}
            min={game.sensRange[0]}
            max={game.sensRange[1]}
            step={game.sensStep}
            largeStep={game.sensStep * 10}
            format={{ maximumFractionDigits: 3 }}
          />

          <NumberInput
            label="Mousepad width"
            value={s.padWidthCm}
            onChange={s.setPadWidth}
            min={10}
            max={120}
            step={1}
            largeStep={5}
            suffix="cm"
          />
        </div>

        <div className="mt-5">
          <Eyebrow>Grip</Eyebrow>
          <div className="mt-2">
            <ChoiceGroup
              ariaLabel="Grip style"
              value={s.grip}
              onChange={s.setGrip}
              options={GRIPS}
            />
          </div>
        </div>
      </Card>

      <Card tone="accent">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>That works out to</Eyebrow>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-[44px] leading-none tabular tracking-tight text-text">
                {cm.toFixed(1)}
              </span>
              <span className="text-base text-text-3">cm per 360°</span>
            </div>
          </div>
          <div className="text-right">
            <Eyebrow>eDPI</Eyebrow>
            <div className="mt-1.5 font-mono text-base leading-none tabular text-text-2">
              {edpi(s.sens, s.dpi).toFixed(0)}
            </div>
          </div>
        </div>

        <TravelMeter cm360={cm} padWidthCm={s.padWidthCm} />

        {sanity.messages.length > 0 && (
          <ul className="mt-5 space-y-1.5 border-t border-accent-5 pt-4 text-[13px]">
            {sanity.messages.map((m) => (
              <li
                key={m}
                className={sanity.level === "danger" ? "text-crit" : "text-warn"}
              >
                {m}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <DpiCheck />

      <Card>
        <CardHeader title="Drill" />
        <ChoiceGroup
          ariaLabel="Training drill"
          columns={2}
          value={s.scenarioId}
          onChange={s.setScenario}
          options={Object.values(SCENARIOS).map((sc) => ({
            id: sc.id,
            label: sc.name,
            hint: sc.description,
            meta: `${sc.shotCount} shots`,
          }))}
        />
      </Card>

      <Disclosure title="Options" summary="Colour, target size, sound">
        <div className="space-y-5">
          <div>
            <Eyebrow>Colours</Eyebrow>
            <p className="mb-2.5 mt-1.5 text-[13px] text-text-3">
              Every option stays readable if you&rsquo;re colour blind. Pick the one that
              matches your vision.
            </p>
            <ChoiceGroup
              ariaLabel="Colour scheme"
              columns={2}
              value={s.palette}
              onChange={s.setPalette}
              options={PALETTE_LIST.map((p) => ({
                id: p.id,
                label: p.name,
                hint: p.note,
                meta: <Swatches palette={p} />,
              }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
            <NumberInput
              label="Target size"
              value={s.targetScale}
              onChange={s.setTargetScale}
              min={0.6}
              max={2.5}
              step={0.1}
              format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
              suffix="×"
            />
            <p className="text-[13px] leading-relaxed text-text-3">
              Makes every target bigger or smaller. Only compare rounds shot at the same
              size.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <SwitchRow
              checked={s.mixedSizes}
              onChange={s.setMixedSizes}
              label="Vary target size"
              hint="Widens the difficulty breakdown, but feels random"
            />
            <SwitchRow
              checked={s.showViewmodel}
              onChange={s.setShowViewmodel}
              label="Show weapon"
              hint="Never affects your aim"
            />
            <SwitchRow
              checked={s.audioEnabled}
              onChange={s.setAudioEnabled}
              label="Sound"
            />
          </div>
        </div>
      </Disclosure>

      <div className="flex flex-wrap items-center gap-4 pt-5">
        <ButtonLink href="/train" variant="primary" size="lg">
          Start <ArrowRight />
        </ButtonLink>
        {s.history.length > 0 && (
          <ButtonLink href="/history" variant="secondary" size="lg">
            {s.history.length} past rounds
          </ButtonLink>
        )}
        {!s.inputScaleVerified && (
          <span className="text-[13px] text-text-3">
            Check your DPI first for accurate results.
          </span>
        )}
      </div>
    </div>
  );
}

/** Names alone don't tell you what a scheme looks like. */
function Swatches({ palette }: { palette: TargetPalette }) {
  return (
    <span className="flex items-center gap-3">
      {[
        { color: palette.target, label: "target" },
        { color: palette.hit, label: "hit" },
        { color: palette.miss, label: "miss" },
      ].map((sw) => (
        <span key={sw.label} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: sw.color }}
            aria-hidden
          />
          {sw.label}
        </span>
      ))}
    </span>
  );
}
