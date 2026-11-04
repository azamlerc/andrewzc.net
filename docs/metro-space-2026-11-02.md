# Metro Space — 2026-11-02

Created `metro-space` as 🌌 Metro Space, with `propertyOf: "stations"`, a map fitted to the entries, and a link under Names in trains.html. Content changes use the MongoDB connector; no local data JSON was changed.

## Entries

| Icon | Station | Reference | Visit status | Action |
|---|---|---|---|---|
| 🔴 | Champ de Mars–Tour Eiffel | Paris | Visited | Added |
| ⭐ | Charles de Gaulle–Étoile | Paris | Visited | Updated existing |
| 🧑‍🚀 | Cosmonautes | Saint-Denis | Visited | Added |
| 🌎 | World Trade Center | New York | Visited | Updated existing |
| 🔱 | Neptune Avenue | New York | Visited | Added |
| 🔭 | Observatorio | Mexico City | Visited | Updated existing |
| ☀️ | Sol | Madrid | Visited | Updated existing |
| ⭐ | Estrella | Madrid | Visited | Added |
| ♀️ | Venus | Parla | Unvisited | Added |
| 🌟 | Estrella Polar | Parla | Unvisited | Added |
| ⭐ | Zvezdnaya | Saint Petersburg | Unvisited | Added |
| 🧑‍🚀 | Kosmonavtlar | Tashkent | Unvisited | Added |
| 🧑‍🚀 | Prospekt Kosmonavtov | Yekaterinburg | Unvisited | Added |
| 🧑‍🚀 | Gagarinskaya | Samara | Unvisited | Updated existing |
| 🧑‍🚀 | Gagarinskaya | Novosibirsk | Unvisited | Updated existing |
| ☿️ | Mercure | Lille | Unvisited | Added |

Six existing stations gain `props.metro-space`; ten new station records are added. Existing keys and unrelated station properties are retained. The country flag remains on the parent; the space icon is stored in `props.metro-space.icons`.

London, Paris and completed-metro visit rules were used. Other known station visits were preserved. Unknown visit history defaults to false. Cosmonautes is on the Paris tramway network, whose existing system entry is marked done. Parla is a separate tram system and is not covered by completing Madrid Metro.

## Identification and source corrections

- Andrew explicitly confirmed World Trade Center qualifies through “World”, represented by 🌎. Its existing station record linked to WTC Cortlandt; the requested PATH link and its station position were applied.
- Champ de Mars–Tour Eiffel is the RER station. It is separate from the existing closed Champ de Mars Métro station.
- The canonical existing Charles de Gaulle–Étoile station was used, preserving its other props; an unrelated older duplicate was not included in this page.
- Estrella Polar is in Parla, not Madrid.
- The supplied links for Zvezdnaya and Prospekt Kosmonavtov did not resolve; verified articles are [Zvyozdnaya](https://en.wikipedia.org/wiki/Zvyozdnaya) and [Prospekt Kosmonavtov](https://en.wikipedia.org/wiki/Prospekt_Kosmonavtov).
- Cosmonautes is confirmed by [RATP](https://www.bonjour-ratp.fr/arrets-tramway/cosmonautes/) and Wikipedia station lists. Its supplied individual article did not resolve, so its entity links to the [French T1 article](https://fr.wikipedia.org/wiki/Ligne_1_du_tramway_d%27%C3%8Ele-de-France). Coordinates come from the [station list](https://en.wikipedia.org/wiki/List_of_tram_stops_in_%C3%8Ele-de-France).
- Name associations need not be literal station namesakes. For example Champ de Mars can evoke Mars despite the military field naming, and Mercure evokes Mercury despite being named for a business centre.

## Excluded after review

Read-back verification passed: 16 station memberships, eight visited and eight unvisited. All intended fields and space icons match; existing unrelated station props are preserved. The page reads from stations, and the Trains index contains its link. Local diff whitespace checks passed.

- **Mars, Barcelona** — excluded as an unverified, hallucinated suggestion. No record was added. Andrew confirmed this should be dropped on 2026-11-02; it is no longer pending.
- **Porte de la Lune, Bordeaux** — excluded. Andrew clarified on 2026-11-02 that Port de la Lune is a harbor with a nearby tram stop, but the stop does not bear that name. No record was added; it is no longer pending.
- **Champ de Mars–Tour Eiffel, Paris** remains included. A fresh database check confirmed that it is present and neither rejected suggestion has a Metro Space membership.

