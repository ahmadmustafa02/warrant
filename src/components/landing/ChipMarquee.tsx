const chips = [
  'direct_override',
  'fake_system_turn',
  'hidden_markup',
  'citation_bait',
  'spaced_obfuscation',
  'task_disguise',
  'multi_step_chain',
  'authority_urgency',
  'roleplay_mode_switch',
  'instructions_section',
];

export function ChipMarquee() {
  const loop = [...chips, ...chips];
  return (
    <div className="marquee py-3" aria-hidden="true">
      <div className="marquee-track">
        {loop.map((chip, index) => (
          <span
            key={`${chip}-${index}`}
            className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
