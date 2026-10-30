# 桃園機場降落 Taoyuan Landing

Fly a China Airlines, EVA Air or STARLUX airliner down to Taiwan Taoyuan International Airport (TPE / RCTP) and
land it. A browser flight simulator made only for landing, with real-ish physics, an ILS approach, callouts, the
tower on the radio and a score for every landing.

Play online: https://ywchen0711.github.io/taoyuan-landing/

Plain HTML + JavaScript with Three.js, no build step. Everything is made in code: the aircraft, their liveries
(approximations of the airlines' colours, not the real artwork), the airport, the countryside, the sounds.

## The aircraft

| Airline | Aircraft | Callsign |
|---|---|---|
| 中華航空 China Airlines | A350-900, 777-300ER, A321neo | DYNASTY |
| 長榮航空 EVA Air | 787-10, 777-300ER, A321neo | EVA |
| 星宇航空 STARLUX | A350-900, A321neo | STARWALKER |

Each type has its own size, weight, wing, thrust, approach speed (Vref) and tail-strike angle. The gear folds, the
flaps and spoilers move, and the navigation lights, strobes, beacon and landing lights work.

## The airport

Both of Taoyuan's runways (05L/23R and 05R/23L, 053°/233°), painted with threshold bars, numbers, touchdown-zone
and aiming-point markings and tyre rubber. There are taxiways with high-speed exits, aprons, Terminals 1 and 2, the
control tower, the airlines' maintenance hangars, a fuel farm and aircraft at the gates. The lights are all there:
approach lights with the sequenced flashers (the "rabbit"), PAPI (two white, two red on the glide path), edge,
centreline (red and white near the end), touchdown zone, threshold and end lights, taxiway lights, apron floodlights.
Around it: the farmland and the ponds (埤塘) of Taoyuan, Dayuan, Luzhu, Nankan, Taoyuan, Zhongli and Guanyin, the
coast with its wind turbines and the Taiwan Strait, the Linkou hills, and the Central Mountain Range on the horizon.

## Flying it

- A flight model with lift, drag, thrust and weight (flaps, gear, spoilers, ground effect, stall), engines that
  spool up slowly, wind with gusts, turbulence and (in a storm) wind shear.
- Fly-by-wire like an Airbus: the stick asks for a pitch and roll rate; let go and it keeps the flight path and
  bank. Below 30 ft it holds the pitch, so you must flare yourself.
- On the ground: brakes, autobrake (LO/MED), reversers, ground spoilers, nosewheel steering; the runway is slippery in
  the rain. Hard landings, tail strikes, wingtip and engine strikes and runway excursions are all noticed.
- ILS: localizer and glideslope on the HUD, a flight director, an autopilot that can fly the approach to 200 ft, and
  an autothrottle that holds Vref + 5.
- Callouts ("one thousand", "minimums", "fifty, forty, thirty, twenty, ten", "retard"), ground-proximity
  warnings (sink rate, pull up, too low gear/flaps, glideslope, bank angle), stall and overspeed. Taipei Tower
  clears you to land, and welcomes you to Taoyuan afterwards.
- Six cameras: cockpit with HUD, chase, orbit, tower, runway side, wing.
- A landing report (touchdown rate, G, touchdown point, centreline, crab, speed, pitch, runway left) with stars, and
  a replay from the ground.

## Scenarios

First landing (the autopilot flies you to 200 ft), ILS approach from 10 nm, sunset, night, crosswind, rain and fog
at night, typhoon outskirts, and a custom flight: runway, time of day, weather, wind, distance, assists.

## Controls

| | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Pitch / roll | W/S ↑/↓ (↓ = nose up), A/D ←/→ | left stick | drag the yoke |
| Rudder | Q / E | right stick | |
| Throttle | R / F | RT / LT | slider |
| Flaps | V (Shift+V up), [ ] | X / Y | FLAP+ / FLAP− |
| Gear | G | LB | GEAR |
| Brakes | Space (hold) | A | BRAKE |
| Reversers | X | B | REV |
| Speed brake | B | | |
| Autopilot / autothrottle | P / T | Back | AP / A/T |
| Camera | C, or 1–6 | RB | 🎥 |
| Pause | Esc | Start | ⏸ |

On an iPad you can also tilt the tablet like a yoke (turn on 📱 in the menu).

## Files

`js/data.js` (aircraft, airlines, runways, scenarios), `js/world.js` (terrain, airport, lights, weather),
`js/aircraft.js` (the models and liveries), `js/flight.js` (flight model, ILS, autopilot, grading), `js/hud.js`,
`js/audio.js`, `js/main.js`.
