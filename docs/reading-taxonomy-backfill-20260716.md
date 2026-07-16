# Reading taxonomy backfill — 2026-07-16

Reversible backup + classification record for the Reading subtopic backfill.

- Subject: `Reading` (`subject_id = 81f064c1-0c34-4c83-b97a-08799335075e`)
- Total non-deleted Reading questions audited: **93**
- Already valid (category **and** subtopic): **15** (all `poetry`, untouched)
- Missing subtopic (valid category, `subtopic_code IS NULL`): **78** → classified below
- Missing/invalid category: **0** — every Reading question already carried a valid canonical `domain_code`
- Invalid subtopic values: **0**
- Legacy / vague category or subtopic strings (`reading`, `general`, `other`, `mixed`, …): **0**

No category (`domain_code`) value was changed. The fix is purely populating the
78 NULL `subtopic_code` values. Reverting = set `subtopic_code = NULL` for the 78
`question_id`s below.

`category` = `domain_code`; `subtopic` = `subtopic_code` in this schema.

| external_id | question_id | old_category | old_subtopic | new_subtopic | reason |
|---|---|---|---|---|---|
| rd-prs-001 | 9f96385a-9d02-4412-9ffe-4eac9660d8c7 | comprehension_comparison | (null) | evidence_and_information_retrieval | "How does Mara know…" locate a stated detail |
| rd-prs-002 | a4086164-0df0-4ad5-93f7-f3ae7c0b0c59 | comprehension_comparison | (null) | vocabulary_in_context | Meaning of the word "weathered" in the passage |
| rd-prs-003 | ea846025-37a3-41e4-b655-94f9f22cb040 | comprehension_comparison | (null) | language_techniques | Effect of the simile "handfuls of gravel" |
| rd-prs-004 | 819aa7f4-cd1b-4d7e-9cfe-d3135f413ced | comprehension_comparison | (null) | inference_and_drawing_conclusions | Inferring the implied point of Anton's dialogue |
| rd-prs-005 | 191d7606-b3ed-49ee-bd20-73695e13dd32 | comprehension_comparison | (null) | character_setting_and_events | What the description conveys about Anton's character |
| rd-prs-006 | 86d60e44-7ca2-48b9-85ac-c11afab334d0 | comprehension_comparison | (null) | main_idea_and_theme | Overarching theme via Mara's changing view |
| rd-prs-007 | 6c0b6e41-36dd-4939-9343-2a959195cb69 | comprehension_comparison | (null) | evidence_and_information_retrieval | Locate stated detail after losing the race |
| rd-prs-008 | 7a1672e7-d015-4634-b381-fabcbba04598 | comprehension_comparison | (null) | inference_and_drawing_conclusions | Inferring narrator's hidden awareness from a line |
| rd-prs-009 | 178d3c7f-ac73-488a-a24c-7135b303f610 | comprehension_comparison | (null) | tone_attitude_and_viewpoint | Overall tone of the extract |
| rd-prs-010 | 55e06c83-cc58-4499-bd30-62e91577c24e | comprehension_comparison | (null) | language_techniques | Effect of the word "cheerfully" |
| rd-prs-011 | 2cb5da6c-b66b-4c95-8da3-c60ffe3423c5 | comprehension_comparison | (null) | character_setting_and_events | What Dev's action reveals about his values |
| rd-prs-012 | 1e925cdd-40e6-480a-8974-50450dbfb0fe | comprehension_comparison | (null) | main_idea_and_theme | Closing sentence turns defeat into a theme |
| rd-prs-013 | ac7c4699-2160-4c43-8b65-f51b57a265f3 | comprehension_comparison | (null) | evidence_and_information_retrieval | Locate stated detail in Extract A |
| rd-prs-014 | 8defa142-ead0-4b53-b11c-0a86853f2af6 | comprehension_comparison | (null) | language_techniques | Effect of the simile "handed a key" |
| rd-prs-015 | afc05c10-cdb2-47c7-8df5-5c4b97903f70 | comprehension_comparison | (null) | author_purpose_and_audience | Purpose of the writer's contrast/argument |
| rd-prs-016 | d0d05450-001a-409e-81bc-4b376d22ed93 | comprehension_comparison | (null) | vocabulary_in_context | Meaning of phrase "charges rent on our attention" |
| rd-prs-017 | afae987a-a8e5-4435-b2d8-d721d231c77d | comprehension_comparison | (null) | paired_extract_comparison | Difference between the two extracts |
| rd-prs-018 | 49f695e7-1f5e-429f-99a6-3edb8535c47e | comprehension_comparison | (null) | paired_extract_comparison | Idea suggested by BOTH extracts |
| rd-prs-019 | 3c9660f5-11f4-4146-bbbb-c8a6d7535fb5 | comprehension_comparison | (null) | tone_attitude_and_viewpoint | Writer's attitude toward Mrs Odili |
| rd-prs-020 | c6bac634-c685-4df5-a59f-584390456e5e | comprehension_comparison | (null) | language_techniques | Effect of the surprising word "radical" |
| rd-syn-001 | df72224b-51d2-460d-8f14-d391838b4b29 | comprehension_comparison | (null) | multiple_extract_matching | "Which extract…" across 4 extracts (zoos) |
| rd-syn-002 | a3d22f74-2295-4be7-a566-0835e6b35620 | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-003 | 582bf88f-42e4-4a1d-a10c-75c299fa24af | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-004 | 49e77b07-ad4e-440e-8475-1a31da27aa14 | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-005 | c55da325-66b8-42ed-99b2-af135e95067c | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-006 | c92a4ef3-e6d6-4447-a2c2-057743a9d1ab | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-007 | 2de968ac-958f-4a01-8056-620d0c78a947 | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-008 | 4c19cf78-1652-409c-b88e-1a12193f061f | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-009 | 584f64c8-8d82-44a8-a210-a0e7d4d59ad6 | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-010 | fa7eb2f8-1d53-4fe9-bff7-6c5dd5927d19 | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-011 | 54be753a-cada-4b2b-ad0b-4b6563a72f02 | comprehension_comparison | (null) | multiple_extract_matching | "Which extract…" across 4 extracts (bees) |
| rd-syn-012 | 8d6cb58b-91c7-4acf-87ae-132c5fcae648 | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-013 | 38ad5a3b-f2a2-44a4-9309-53da0a21e6fc | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-014 | 11d137eb-06dc-4070-84bb-0b6d9063c8aa | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-015 | 111050c0-95f6-49f5-825b-aca2ea28c7dd | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-016 | 188b3ecf-b620-42ba-8073-0b326193da4b | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-017 | d62b45d9-62ee-451f-9292-3bda110d2e31 | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-018 | da22f727-fbe0-4546-94bc-bd9ab8b3ae28 | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-019 | 4a4fd68f-0048-4252-9d57-cbbe58a47b01 | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-020 | d151c8e4-b09b-4bf8-9f80-2c0117379929 | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-021 | 274373cd-cf18-4ebc-87ed-29812a6d58f6 | comprehension_comparison | (null) | multiple_extract_matching | "Which extract…" across 4 extracts (storms) |
| rd-syn-022 | 196c74e8-e807-43ed-b036-9b8b0d2a94a8 | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-023 | 413538db-e718-4f33-9076-10b8139441a2 | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-024 | 2fff8f85-4482-4ca8-aaf9-dc6bd803f31b | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-025 | 591974c5-ecea-4729-8fa9-98cf8870b2fd | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-syn-026 | 36164454-c1d3-4dee-9a43-00617a9c273b | comprehension_comparison | (null) | multiple_extract_matching | Match across 4 extracts |
| rd-clz-001 | ed697c7b-1f4b-4fc8-81b0-a248bcf88444 | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-002 | 9757ac82-dc54-4095-9456-3df87b7cbde5 | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-003 | 8f77563c-a908-4efd-ae91-507146d3504f | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-004 | 77719455-d83c-47ad-bb38-6bfde183fa13 | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-005 | 242ad676-5cea-42f8-8ed0-638e2c68c786 | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-006 | 43d0f03a-5b10-4ecb-82d3-ddfeb319bd45 | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-007 | 34ba1d4b-3d53-4c02-a510-461c8cd017d5 | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-008 | 9b5f14a0-25f1-4843-a601-868b22af815b | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-009 | be3da31c-9831-4fbe-9251-fbf3d3dd8a31 | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-010 | 6cc53ace-50be-45e8-83d9-2901d9ec79d8 | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-011 | d939b351-8080-4527-986f-21c2d921f56d | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-012 | a1f40dc1-a576-4487-965e-5b7c5071d7a9 | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-013 | 85f1c60f-986b-4334-ba9d-6c54a77d7612 | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-014 | 057b5662-53cd-4e2c-b14a-87d671ccda8a | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-015 | 8ea319d4-3594-4982-aeb8-bb7352befc2d | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-016 | 2f11edec-5a5e-4c75-b161-ed49bc027c20 | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-017 | 171ce044-de38-487a-8724-a27bfbb79936 | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap (leans collocation) |
| rd-clz-018 | 72a22baf-b64d-4fe7-847d-6be8409192e1 | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-019 | 44487382-a3a6-41d8-aeaa-c50cf0163e6e | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap |
| rd-clz-020 | 038f6592-6584-46b8-b902-ecd930db3435 | cloze_language | (null) | vocabulary_and_precise_word_choice | Choose best near-synonym for gap (leans collocation) |
| rd-coh-001 | f56ff9ef-8714-4e3c-8e6d-fd5d49eacb9c | text_structure_cohesion | (null) | sentence_insertion | "Which sentence best fits gap…" |
| rd-coh-002 | 13ca4e5c-1441-4ec5-b77e-87a346c7e47c | text_structure_cohesion | (null) | sentence_insertion | "Which sentence best fits gap…" |
| rd-coh-003 | c68e6747-ff08-4590-ae02-f9738ae44bc2 | text_structure_cohesion | (null) | sentence_insertion | "Which sentence best fits gap…" |
| rd-coh-004 | b467fce4-64c7-4b63-b057-9db1e0a9bde5 | text_structure_cohesion | (null) | sentence_insertion | "Which sentence best fits gap…" |
| rd-coh-005 | 1894567a-853e-4990-b47d-55ef5ad5e581 | text_structure_cohesion | (null) | sentence_insertion | "Which sentence best fits gap…" |
| rd-coh-006 | 5adb10c0-2beb-4fd2-a0ce-097dc79e9784 | text_structure_cohesion | (null) | sentence_insertion | "Which sentence best fits gap…" |
| rd-coh-007 | ba5d63f3-6b17-49be-aad7-f8bbbf1fdfa0 | text_structure_cohesion | (null) | paragraph_summarisation | "Which summary best states the main point of paragraph…" |
| rd-coh-008 | 261d8d43-11b6-4c27-a68a-e5e3bf26db68 | text_structure_cohesion | (null) | paragraph_summarisation | "Which summary best states the main point of paragraph…" |
| rd-coh-009 | da20a8fb-baa8-49a3-a85e-428582cc7888 | text_structure_cohesion | (null) | paragraph_summarisation | "Which summary best states the main point of paragraph…" |
| rd-coh-010 | c800fdcb-105d-4b95-ab04-86d9b9acc864 | text_structure_cohesion | (null) | paragraph_summarisation | "Which summary best states the main point of paragraph…" |
| rd-coh-011 | 683d7109-9a77-41a5-8bbb-e69a02252f26 | text_structure_cohesion | (null) | paragraph_summarisation | "Which summary best states the main point of paragraph…" |
| rd-coh-012 | 99bb4811-a078-4da7-ab6b-0948a92fbaa2 | text_structure_cohesion | (null) | paragraph_summarisation | "Which summary best states the main point of paragraph…" |

## Uncertain / best-fit classifications (documented, not blocking)

- **rd-prs-011** (Dev handing over the crown): character-values inference — placed
  under `character_setting_and_events`; `inference_and_drawing_conclusions` is a
  defensible alternative.
- **rd-prs-006** (Mara's developing view of the lighthouse): tracks a character's
  changing perception toward a thematic realisation — placed under
  `main_idea_and_theme`; `character_setting_and_events` is defensible.
- **rd-clz-017 / rd-clz-020**: the correct answer is a fixed collocation
  ("hold its breath", "didn't mind") rather than pure synonym precision. Kept under
  the umbrella `vocabulary_and_precise_word_choice` (the dominant skill across the
  cloze set) for consistency rather than splitting one or two items into
  `collocations_and_common_expressions`.
