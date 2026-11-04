# Madrid notes import — 2026-11-03

All content changes use the MongoDB Atlas connector. No local data JSON was edited.

## Imported

| Stored list | Entity | Station properties | Action |
|---|---|---|---|
| `stations` | Chamberí | `curved` | Added |
| `stations` | Colonia Jardín | `intermodal` | Added |
| `stations` | Siglo XXI | `metro-numbers` | Added |
| `stations` | Nuevo Mundo | `metro-space` | Added |
| `stations` | Bélgica | `metro-places`, `twin-stations` | Added |
| `stations` | Aravaca | `intermodal` | Added |
| `stations` | Avenida de Europa | `metro-places` | Added |
| `stations` | Tribunal | `deep-level` | Added |
| `depots` | Cocheras | — | Added |
| `interurbans` | Metro Ligero | — | Added |
| `parks` | Casa de Campo | — | Added |
| `stations` | Avenida de América | `intermodal` 🚇 🚌 | Updated |
| `stations` | Príncipe Pío | `intermodal` 🚃 🚇 | Updated |
| `stations` | Belgica, Brussels | `twin-stations`, group `belgica` | Updated |
| `abandoned` | Chamberí | Direct-list entry | Existing entry reused; Spanish link updated |
| `heritage` | Estación de Chamberí | Direct-list museum entry | Existing visited entry verified |

There are 11 new records, four updated records and one already-correct record. Every listed record is `been: true`, based on today’s notes, completed Madrid systems, or existing recorded visits. Existing station props are preserved.

## Chamberí’s separate meanings

- Curved Platforms: new parent station `stations/madrid-chamberi`, `props.curved: true`, top-level `strike: true`, `been: true` because Andrew passed through.
- Abandoned Stations: existing `abandoned/chamberi`, `been: true`, no strike. All entries on that page are closed by definition; strike would mean it no longer qualifies as closed. This is a direct list, not props.
- Heritage: existing `heritage/estacion-de-chamberi` remains visited. Andrew explicitly counts seeing it from the passing train as sufficient, even without entering the museum.

The closed parent station’s strike does not leak to the separate Heritage or Abandoned records.

## Station details

- Colonia Jardín: `props.intermodal: {value: true, icons: ["🚇","🚋"]}`.
- Siglo XXI: normalized the note’s “Siglio XXI”; `order: 21`, Metro Numbers icons 2️⃣ 1️⃣.
- Nuevo Mundo: Metro Space with 🌎.
- Bélgica, Madrid: Metro Places 🇧🇪 and Twin Stations group `belgica`.
- Belgica, Brussels: reused existing station, same group `belgica`. Corrected erroneous Spanish parent flag and Madrid Wikipedia link to 🇧🇪 and the [French Brussels station article](https://fr.wikipedia.org/wiki/Belgica_(métro_de_Bruxelles)). Corrected `countries` to Belgium alone; its existing Metro Places prop remains intact.
- Aravaca: intermodal 🚃 🚋.
- Avenida de Europa: Metro Places 🇪🇺.
- Avenida de América: intermodal 🚇 🚌; retained its other props.
- Príncipe Pío: intermodal 🚃 🚇; retained cross-platform and infill membership. Saved Andrew’s observation about suburban tracks passing directly above the Line 10/6 cross-platform interchange and why it is unusually notable.
- Tribunal: `props.deep-level: {value: true, depth: 40}`; depth is in metres, supplied by Andrew.

## Other lists

- Cocheras depot: reference/city Madrid; position is Andrew’s supplied depot location, not the passenger stop location. The [Cocheras station article](https://es.wikipedia.org/wiki/Estación_de_Cocheras_(Metro_Ligero_de_Madrid)) explicitly identifies the adjacent Metro Ligero depot.
- Interurbans: Metro Ligero, reference/city Madrid. The caption identifies the interurban ML2/ML3 connections to Pozuelo de Alarcón and Boadilla del Monte. Added a page note documenting this modern-light-rail inclusion alongside older interurbans.
- Casa de Campo: added to Parks, using the [Spanish park article](https://es.wikipedia.org/wiki/Casa_de_Campo), not the Metro station.

## Locations and links

Supplied positions were used exactly for Cocheras, Siglo XXI, Nuevo Mundo, Bélgica and Avenida de Europa. All locations are GeoJSON Points in longitude, latitude order; no legacy `coords` fields were created or synchronized.

Other new station and park positions came from verified Wikipedia articles. Madrid entries use Spanish links; Brussels uses French. Existing keys were preserved; new station keys use Madrid plus station name.

## Clarifications

No items are parked. Interurban was matched to the existing `interurbans` page and deepest to `deep-level`. The supplied transit-mode emoji pairs are stored in page-specific props rather than parent icons.

## Verification

Read-back verified all 16 records: all are visited, every intended field matches, and existing unrelated station props are preserved. Chamberí is struck only on the closed parent station, not on Abandoned or Heritage. Both Bélgica/Belgica stations share group belgica and have the correct country flags. All write operations succeeded; local diff checks passed.

