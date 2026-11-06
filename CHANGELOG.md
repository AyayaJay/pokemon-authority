# Pokémon Authority — Patch Notes

Newest first. The build number (for example `1105-2353`) is shown on the home screen.
It is the date and time of the build: month, day, hour, minute (Pacific time).

---

## Nov 6, 2026 — build 1106-0017

- **Close-range hits knock back and stagger:** landing a close-range move shoves the target back (farther for stronger moves and when you're bigger than it) and staggers it for a moment. This **cancels a held beam** (Flamethrower, Water Gun…) or an attack it was about to throw ("Interrupted!"). Gods and Dynamaxed Pokémon aren't pushed or staggered.

## Nov 6, 2026 — build 1106-0014

- **Close-range moves (Scratch, Tackle, Slash, punches, bites…) hit a cone in front of you** instead of only the touched target: reach ≈ body + 150 (a bit more for big Pokémon), 110° wide. Every enemy inside the cone is hit (several at once in 2v2/3v3). A white-and-type-coloured slash shows the swing.
- **Clearer attack markers:** thicker outlines that stay the same thickness at any zoom, brighter fill, white inner edge. Yours are cyan, enemy ones red. The melee cone fills outward so you can see it coming. Area circles are now true circles that match the real hit area.

## Nov 6, 2026 — build 1106-0009

- **Difficulty setting: Easy / Normal / Hard** (Settings, or OPTIONS in Adventure). Default is **Normal**, which is easier than the old enemy AI. Only enemies are affected; your partners and Auto play at full skill.

| | Easy | Normal (default) | Hard (old AI) |
|---|---|---|---|
| Time between enemy attacks | ~2.5 s | ~1.95 s | 1.4 s |
| Enemy aim | sloppy, no leading | slightly off | aims ahead of you |
| Enemy dodging | 30% as often | 60% | 100% |
| Focuses your weakest Pokémon (2v2/3v3) | no | yes | yes |
| Enemy damage | ×0.8 | ×0.92 | ×1.05 |
| Trainer Road enemy EVs per trainer | +5 | +9 | +12 |

## Nov 6, 2026 — build 1105-2358

- **Dodge = 0.5 s of invincibility** (was 0.32 s). Nothing that hits you during it does damage: moves, held beams, area blasts, and now also map eruptions / lightning. Damage that was already on you (burn, poison, Leech Seed) still ticks. Your Pokémon gets a flashing blue outline while it's untouchable. Perfect-dodge window slightly wider (0.18 s).

---

## Nov 5, 2026 (night) — builds 1105-2224 to 1105-2353

### Controls
- **New default keys:** Ctrl = Auto, A / S / D = Time / Space / Antimatter, F = Special (uses whatever special your current Pokémon has). G and V are free. Saved key settings were reset once.
- **Held moves are marked:** moves that keep firing while you hold the key (Water Gun, Flamethrower, Thunderbolt, Ice Beam, Bubble Beam, Ember, Absorb, Giga Drain…) have a yellow **HOLD** tag on their card (꾹 in Korean).
- **Esc closes Settings and the pause menu**, one window at a time.

### Battle screen (UI)
- **PC layout:** the four moves sit in one row in the middle of the bottom bar; Special and Time / Space / Antimatter are right above them; items, Dodge and Bag on the right.
- **Phone layout:** everything under the right thumb — items, moves in a 2 × 2 block, Dodge / Bag at the far right; Special, Ball and Authorities above the moves.
- **Auto and Speed** moved to the top-left of the field.
- **Cooldown boxes under your Pokémon:** small Q W E R boxes and dodge pips under the Pokémon you control, so you don't have to look at the bar while fighting.
- **Move your own buttons:** Pause → "Move buttons" (or Settings) lets you drag any button anywhere. Saved per device. Saved layouts were reset when the defaults changed.
- **Specials are one small button** instead of a big four-button panel; each Pokémon shows only its own special.
- **Screen fills wide phones** (no black side bars); right-side buttons stay at the right edge.
- **Stat changes and status** (Atk+2, burned…) are shown as chips in the top panel instead of small text over the Pokémon.
- **Pop-up texts never overlap** (damage numbers, "Critical hit!", "Super effective!" stack neatly).
- **"Fainted" messages** go to the top-middle bar, one after another, before the "next Pokémon" message.
- **Loading screen** at the start of a battle: all sprites and move pictures load first, so there are no placeholder blobs and the first use of each move shows its animation.
- **"How to battle" tips** appear on the first battle on a device (and in Trainer Road until your first win). The battle waits until you close them. Also in Pause → "How to play".
- **Move names** shrink to fit their card instead of being cut off.
- Result box ("You win / You lose") centred on wide screens.

### Gameplay and balance
- **No random misses for attacks:** if an accuracy roll fails, the attack still hits but only grazes — damage × accuracy² (90% move → 81%, 70% → 49%, 30% OHKO moves → 10%), with no side effects. Status moves (Hypnosis, Will-O-Wisp…) can still miss. Missing by position (walking out of a beam, sidestepping, dodging) still works.
- **Slow Pokémon move much faster:** the slowest now move at about 1.8× their old speed; the fastest are unchanged.
- **Sizes:** small Pokémon are bigger (minimum 92) and giants smaller (maximum 620). Still ordered by real height.
- **Eternamax Eternatus** has a fixed boss size (1100) instead of half the field.
- **Range and beam width grow with size:** big Pokémon reach farther (up to ~1.8×) and fire thicker beams; small ones fire thin beams that are easier to dodge.
- **Each Pokémon brings one Special** (Mega, Z-Move, Terastal, Dynamax or none), picked in the team editor. Your side can still use one per battle.
- **Default moves are level-up moves only** (what the Pokémon would really know at its level), instead of the strongest move it could learn in any way.

### Adventure mode
- **POKéMON summary screen:** picture, level, types, HP, nature, ability, stats (nature up/down coloured), moves with type, power and PP. ← → to switch Pokémon.
- **POKéDEX:** Gen 1–3 list with seen / caught marks, picture, types, height and weight.
- **Fixed:** opening the POKéMON screen froze the game.
- **Fan-game style windows** (white with a blue frame) for the menu, dialogs and all screens.
- **OPTIONS screen inside the game:** music, sound, running mode, shake, damage numbers, battle start, language, controls.
- **Running is on by default** (R toggles, hold Shift / B to walk). New option: **Hold** mode (only run while holding).
- **Key guide bar** at the bottom on PC; labels under the A / B / ☰ buttons on phones.

---

## Nov 5, 2026 (early morning) — builds 1105-0042 to 1105-0148

### Battle feel (Resonance-style)
- **Field is 4400 × 3300** (12:9) with more map features; camera follows your Pokémon at a Resonance-like distance; arrows at the screen edge point to Pokémon out of view.
- **Everyone moves twice as fast**; projectiles fly 60% faster and dodges go 50% farther to match.
- **Walking animation** follows real time (it was twice as fast on 120 Hz phones) and body size.
- **About double attack range** for beams and projectiles.

### Held beams
- **Hold the move key to keep a beam going** (up to 2.4 s; a tap gives a short burst). Hits about 5 times a second and slowly turns after the target. You can only creep while holding; dodging or flinching stops it.
- Uses the move's own animation, replayed while held.

### New
- **Attack range markers:** every attack shows its reach on the ground (blue = yours, red = enemy).
- **Ground marks:** cracks, scorch marks, puddles, frost and goo where attacks land; they fade after a few seconds.
- **Sounds:** hit sounds by effectiveness, Poké Ball throw / wobble / catch sounds.
- **Catching (wild battles):** your trainer stands at the side of the field; press B to aim, B again to throw. Pokémon GO-style ring: throw when it's small for Nice / Great / Excellent. Poké, Great and Ultra Balls in the shop. Caught Pokémon join the party or go to the PC.
- **Form sprites preload** (Mega, Gigantamax, Arceus forms) so form changes are instant.

### Fixes
- Phone menus: ✕ close button, scrolling, tap outside to close; menus turn with the sideways battle screen.

---

## Nov 4–5, 2026 — builds up to 1105-0042

- **Manual control by default:** joystick / keys to move, Q W E R moves, dodge with i-frames, per-move cooldowns, AUTO button.
- **Rebindable controls**, pause menu, settings (volume, shake, damage numbers, auto start, language).
- **Adventure preview:** Gen 3 overworld (Littleroot to Petalburg Woods) with walking, NPCs, signs, doors, menu and wild battles.
- **Clash system:** beam vs beam push contests (mash the key), projectile vs projectile, beam vs projectile.
- **Dodge:** 2 charges, perfect-dodge slow-motion.
- **One gimmick per battle** (Mega / Z / Tera / Dynamax); **Bag with quick slots** (Z X C), Poké Mart, money, HP / status carry over in Adventure.
- **2v2 and 3v3 battles** with smart AI (focus fire on low HP, heals allies near fainting).

---

## Nov 3, 2026 — first versions

- Real-time battles on a top-down arena with Pokémon Showdown / PokeRogue animations, sounds, cries and music.
- Mystery Dungeon portraits, shiny sparkles, faint and recall animations.
- IVs, EVs and natures (editable); level cap 150.
- The four gods (Arceus, Dialga, Palkia, Giratina) with their own rules; Arceus's Legend Plate Judgment.
- Home screen, quick start, **Trainer Road** (20 trainers + Eternamax Eternatus boss), level-ups, evolution, recruits, Authorities unlocked during the run.
- 9 battle maps with hazards (Volcano, Beach, Ice Field, Desert, Cave, Thunder Plains, Forest, Psychic Ruins, Power Spot).
- Balance passes: HP ×3 / stats ×2, recovery moves nerfed, full-strength damage, OHKO moves at 30% accuracy.
- iPhone support (battle drawn sideways in portrait).
