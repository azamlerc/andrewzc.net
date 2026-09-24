# Canadian flag source artwork

Unmodified SVG originals from Wikimedia Commons, downloaded 2026-09-24.
The renderer normalizes each complete design to the existing emoji proportions,
then applies the same cloth silhouette and lighting to all thirteen flags.

These source pages identify the artwork as public domain; they retain creator
credits and the applicable public-domain notices. The downloaded SVGs are kept
unchanged. The rendered PNG derivatives add the cloth warp, lighting and a
standardized aspect ratio.

Regenerate with `node scripts/create_canadian_flags.cjs` from the project root
(requires `sharp`, which can also be provided through `NODE_PATH`). The script
uses the existing Washington flag as its shape and lighting reference, renders
1024×1024 RGBA masters, and downsamples with Lanczos3 to 240×240 RGBA. All flags
use one shared silhouette. It does not preserve their differing physical
aspect ratios, and it never crops their artwork.

- Site assets: `images/flags/{code}.png`
- Retained masters: `images/flags/canadian-1024/{code}.png`
- Comparison sheet, including three existing US flags and 24px samples:
  `images/flags/canadian-1024/preview.png`

| Code | Original and attribution/license information |
| --- | --- |
| AB | https://commons.wikimedia.org/wiki/File:Flag_of_Alberta.svg |
| BC | https://commons.wikimedia.org/wiki/File:Flag_of_British_Columbia.svg |
| MB | https://commons.wikimedia.org/wiki/File:Flag_of_Manitoba.svg |
| NB | https://commons.wikimedia.org/wiki/File:Flag_of_New_Brunswick.svg |
| NL | https://commons.wikimedia.org/wiki/File:Flag_of_Newfoundland_and_Labrador.svg |
| NS | https://commons.wikimedia.org/wiki/File:Flag_of_Nova_Scotia.svg |
| NT | https://commons.wikimedia.org/wiki/File:Flag_of_the_Northwest_Territories.svg |
| NU | https://commons.wikimedia.org/wiki/File:Flag_of_Nunavut.svg |
| ON | https://commons.wikimedia.org/wiki/File:Flag_of_Ontario.svg |
| PE | https://commons.wikimedia.org/wiki/File:Flag_of_Prince_Edward_Island.svg |
| QC | https://commons.wikimedia.org/wiki/File:Flag_of_Quebec.svg |
| SK | https://commons.wikimedia.org/wiki/File:Flag_of_Saskatchewan.svg |
| YT | https://commons.wikimedia.org/wiki/File:Flag_of_Yukon.svg |
