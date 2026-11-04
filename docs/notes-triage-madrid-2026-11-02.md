# Madrid notes import — 2026-11-02

Content was written through the MongoDB Atlas connector to `andrewzc.entities`; no local data JSON was changed.

## Result

- 53 entity records verified: 25 inserted, 28 updated.
- All 53 records have `been: true`, including the existing Paris counterpart.
- Station categories use `stations.props` for pages with `propertyOf: stations`; legacy detail-list records were left alone.
- Spanish Wikipedia links on all requested Madrid entries. The existing French Wikipedia link on Cité Universitaire was retained.
- New records have `dateAdded: "2026-11-02"`.
- Locations use GeoJSON points only. Legacy `coords` was neither created nor synchronized.
- Repeated Ibiza note was processed once.

## Station records

| Station | Properties set | Action |
|---|---|---|
| Avenida de Guadalajara | `metro-places` | Added |
| Puerta de Toledo | `metro-places`, `curved` | Added |
| Quintana | `curved` | Added |
| Santo Domingo | `metro-places` | Updated |
| Sevilla | `metro-places` | Updated |
| Cuatro Caminos | `metro-numbers`, `deep-level` | Added |
| Puerta de Arganda | `cross-platform`, `spanish` | Updated |
| Ibiza | `metro-places` | Updated |
| Pío XII | `metro-numbers` | Updated |
| Ciudad Universitaria | `twin-stations` | Added |
| Sainz de Baranda | `spanish` | Added |
| Pacífico | `metro-places`, `spanish` | Added |
| Buenos Aires | `metro-places` | Updated |
| Miguel Hernández | `spanish` | Added |
| Hospital 12 de Octubre | `metro-numbers` | Added |
| Ciudad de los Ángeles | `metro-places` | Updated |
| Oporto | `metro-places` | Updated |
| Palos de la Frontera | `curved` | Added |
| Callao | `curved` | Added |
| La Latina | `curved` | Added |
| Pirámides | `twin-stations`, `curved`, `spanish` | Updated |
| Carabanchel | `curved` | Updated |
| Campamento | `spanish` | Updated |
| Casa de Campo | `spanish`, `cross-platform` | Updated |
| Príncipe Pío | `cross-platform` | Updated |
| Goya | `metro-people` | Updated |
| Sol | `curved` | Updated |
| Ópera | `curved`, `cross-platform` | Updated |
| Avenida de América | `metro-places`, `spanish` | Updated |
| República Argentina | `metro-places` | Updated |
| Nuevos Ministerios | `moving-walkways` | Added |
| Pinar de Chamartín | `intermodal`, `cross-platform` | Updated |
| Manuel Becerra | `spanish` | Added |
| Sierra de Guadalupe | `metro-places: {value: true, icons: ["🇫🇷"]}` | Added |
| Cité Universitaire, Paris | `twin-stations: true`, group `cite-universitaire` | Updated |

Ciudad Universitaria and Cité Universitaire share group `cite-universitaire`. Pirámides retains its established group `pyramides`, pairing with Paris Pyramides.

Cuatro Caminos records 49 metres as `props.deep-level.depth: 49`, with `value: true` for membership. Metro Numbers order is 4 for Cuatro Caminos and 12 for Pío XII and Hospital 12 de Octubre.

## Other pages

| Page | Entity | Action |
|---|---|---|
| `arches` | Puerta de Alcalá | Updated |
| `stadiums` | Las Ventas | Added |
| `head-on` | Puerta de Arganda | Updated |
| `head-on` | Pinar de Chamartín | Updated |
| `automatic` | Line 6 | Added |
| `furthest` | Puerta de Arganda | Added |
| `depots` | Aluche | Added |
| `shuttles` | Ramal | Updated |
| `bus-stations` | Avenida de América | Added |
| `metro-food` | Tres Olivos | Added |
| `heritage` | Chamartín | Added |
| `circular` | Alcalde Moreno Torres | Updated |
| `planned` | Alcalde Moreno Torres | Added |
| `premetros` | Madrid ML1 | Added |
| `overhead` | Metro | Added |
| `trams` | Madrid | Updated |
| `projects` | Line 3 to El Casar | Updated |
| `towers` | Puerta de Europa | Updated |

## Interpretations and confirmed choices

- “Plaza del Toros” identifies Las Ventas.
- Spelling normalized: Cuatro Caminos, Puerta de Arganda, Rivas-Urbanizaciones, Ciudad Universitaria, Ciudad de los Ángeles, Pacífico, Ramal, Chamartín, and Alcalde Moreno Torres.
- User confirmed the standalone “curved, spanish” refers to Pirámides; both booleans set to true.
- User confirmed Line 6 should be visited with a 🚧 badge because it was ridden during automation works. Its caption explains that it was ridden before automatic service. Added a corresponding exception to Automatic Metros page notes.
- User confirmed French flag for Sierra de Guadalupe is a deliberate Guadeloupe name association. Country remains Spain.
- Metro Food already exists; added Tres Olivos there.
- “Heritage: Chamertin” was interpreted as the historic train exhibition at Chamartín, linked to Spanish Andén 0.
- Alcalde Moreno Torres already existed on Circular Grids. Updated to the supplied location and added it separately to Planned Cities, linked to Sanchinarro.
- Madrid on Trams has `section: "taken"`.
- Line 3 to El Casar has `been: true` and the ✅ badge.
- Furthest has Puerta de Arganda ↔ Rivas-Urbanizaciones, prefix `"5"` km, following the supplied distance.
- Puerta de Europa has `size: 114` and `props.height: 114`.

## Corrections discovered during import

- Campamento station had a location in Colombia; corrected from the Spanish station article.
- Ramal had a point far outside Madrid; corrected to its Ópera endpoint. This is a representative route endpoint, not a claimed route midpoint.
- Pinar de Chamartín on Head-on had Philadelphia as both city and reference. Corrected to Madrid, fixed accent, normalized line info to `1/4`, and corrected location.
- Cité Universitaire had the wrong location in Paris. Corrected to the RER station using coordinates on its French station article.
- Sol's display name was incorrectly “Sól”; corrected to Sol, preserving its key.
- Aluche depot uses the mapped depot polygon position, not the nearby Aluche passenger station point.

## Clarification resolved

**Single Track: Ramal — excluded.** Andrew confirmed that most of the route is double track, with two trains passing each other. The Ramal terminus at Ópera has one platform and one track, which does not make the route single track. Spanish Wikipedia agrees. Shuttles was updated, and the distinction was saved in its entity notes. No Single Track entity was added. No Madrid notes remain parked.

## Verification

All intended fields on all 53 entities were compared with a fresh MongoDB read. No mismatches, write failures, or lost unrelated station properties were found. Project badge and new-record dates were checked.

## Source examples

- [Ramal](https://es.wikipedia.org/wiki/Ramal_(Metro_de_Madrid))
- [Sierra de Guadalupe](https://es.wikipedia.org/wiki/Estación_de_Sierra_de_Guadalupe)
- [Avenida de América](https://es.wikipedia.org/wiki/Estación_de_Avenida_de_América)
- [Andén 0](https://es.wikipedia.org/wiki/Andén_0)
- [Aluche station](https://es.wikipedia.org/wiki/Estación_de_Aluche)
- [Aluche depot mapped footprint](https://mapcarta.com/es/W27880135)
- [Sanchinarro](https://es.wikipedia.org/wiki/Sanchinarro)
- [Cité Universitaire](https://fr.wikipedia.org/wiki/Gare_de_Cité_universitaire)

