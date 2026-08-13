# Corinth linked catalog: 100-lesson release

## Release scope

- 100 unique permanent Corinth content pages.
- Link-only delivery through the authenticated Corinth viewer; LearnXR does not download, cache, proxy, or re-host Corinth assets.
- Provider access expires with the configured license on 13 February 2027. The matching school entitlement uses the same end date.
- Source records contain public catalog descriptions and permanent content URLs only. Credentials, session tokens, query strings, and Corinth thumbnail files are excluded.

## Selection method

The release combines the original 12-item representative pilot with 88 additional items sampled across Human Biology, Animal Biology, Plant Biology, Physics, and Chemistry. Two-dimensional video-only records were excluded from the catalog expansion so the selection remains focused on interactive STEM material.

`corinth-linked-catalog-source-100.json` is the audited source inventory. `npm run build:corinth-catalog` validates URLs and generates the importable `corinth-linked-catalog-100.json` manifest. The generator fails unless the source contains exactly 100 unique Corinth IDs.

## Class and subject classification

The curriculum classifier assigns conservative grade bands from the Corinth category, title, and description. Rules cover human anatomy and physiology, animal anatomy and life cycles, plant structure and reproduction, mechanics, energy, waves, optics, atomic physics, chemical bonding, biomolecules, states of matter, solutions, and periodicity.

The grade progression is grounded in:

- [NCERT Learning Outcomes at the Elementary Stage](https://www.ncert.nic.in/pdf/publication/otherpublications/tilops101.pdf), especially Science for Classes VI-VIII.
- [CBSE Curriculum 2026-27](https://cbseacademic.nic.in/curriculum_2027.html) for secondary Science and senior-secondary Biology, Chemistry, and Physics.
- [CBSE Chemistry XI-XII 2026-27](https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Chemistry_SecP2_2026-27.pdf) for molecular, bonding, biomolecule, and materials topics.

These are discovery classifications for search and filtering. Exact chapter placement remains subject to academic review through `lesson_content_links`; the importer does not fabricate chapter IDs.

## Operational commands

```bash
npm --prefix functions run build:corinth-catalog
npm --prefix functions run stage:corinth-catalog
npm --prefix functions run release:corinth-catalog -- <school-document-id>
```

The release command verifies provider approval and license dates, publishes only the 100 exact manifest revisions, writes audit records, and creates a school entitlement that ends with the provider license.
