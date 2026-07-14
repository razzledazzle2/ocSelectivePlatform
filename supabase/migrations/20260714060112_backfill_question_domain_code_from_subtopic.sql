-- Backfill / canonicalise questions.domain_code from subtopic_code.
--
-- Why: a question's canonical domain is derived from its subtopic (a subtopic
-- always belongs to exactly one domain). The student mastery/coverage views
-- group purely by subtopic_code -> domain and never read the stored domain_code,
-- while the admin question bank filters on domain_code directly. Rows that
-- carried a subtopic_code but a NULL (or stale) domain_code therefore showed up
-- correctly for students yet vanished from the admin domain filter.
--
-- This migration makes the two agree by storing the canonical domain_code for
-- every row whose subtopic is known to the taxonomy. The application-side fix
-- (resolveCanonicalDomainCode + the expanded admin domain filter) keeps things
-- correct for any future row even if this column ever drifts again; this is the
-- one-off data repair for existing rows.
--
-- Non-destructive: rows whose subtopic_code is NOT in the canonical taxonomy are
-- left untouched (surfaced for human review, never guessed). Idempotent: safe to
-- run more than once (only rows that actually differ are updated).

begin;

-- Canonical subtopic_code -> domain_code map (generated from
-- src/lib/taxonomy/canonical-taxonomy.ts — keep in sync with that single source).
create temporary table _subtopic_domain (subtopic_code text primary key, domain_code text not null)
  on commit drop;

insert into _subtopic_domain (subtopic_code, domain_code) values
  ('single_extract_comprehension', 'comprehension_comparison'),
  ('paired_extract_comparison', 'comprehension_comparison'),
  ('multiple_extract_matching', 'comprehension_comparison'),
  ('main_idea_and_theme', 'comprehension_comparison'),
  ('character_setting_and_events', 'comprehension_comparison'),
  ('author_purpose_and_audience', 'comprehension_comparison'),
  ('tone_attitude_and_viewpoint', 'comprehension_comparison'),
  ('language_techniques', 'comprehension_comparison'),
  ('inference_and_drawing_conclusions', 'comprehension_comparison'),
  ('vocabulary_in_context', 'comprehension_comparison'),
  ('evidence_and_information_retrieval', 'comprehension_comparison'),
  ('vocabulary_and_precise_word_choice', 'cloze_language'),
  ('grammar_and_usage', 'cloze_language'),
  ('connectives_and_cohesion', 'cloze_language'),
  ('collocations_and_common_expressions', 'cloze_language'),
  ('meaning_from_context', 'cloze_language'),
  ('poetry_meaning_and_theme', 'poetry'),
  ('poetry_imagery_and_figurative_language', 'poetry'),
  ('poetry_tone_and_mood', 'poetry'),
  ('poetry_speaker_and_perspective', 'poetry'),
  ('poetry_structure_and_form', 'poetry'),
  ('poetry_sound_and_rhythm', 'poetry'),
  ('sentence_insertion', 'text_structure_cohesion'),
  ('paragraph_heading_matching', 'text_structure_cohesion'),
  ('paragraph_summarisation', 'text_structure_cohesion'),
  ('sequencing_and_organisation', 'text_structure_cohesion'),
  ('cohesion_across_a_text', 'text_structure_cohesion'),
  ('arithmetic_number_reasoning', 'number_algebra'),
  ('place_value_and_rounding', 'number_algebra'),
  ('factors_multiples_and_divisibility', 'number_algebra'),
  ('fractions', 'number_algebra'),
  ('decimals', 'number_algebra'),
  ('percentages', 'number_algebra'),
  ('ratio_rates_proportion', 'number_algebra'),
  ('algebra_and_unknowns', 'number_algebra'),
  ('patterns_and_sequences', 'number_algebra'),
  ('counting_and_combinations', 'number_algebra'),
  ('length_mass_capacity', 'measurement_financial'),
  ('time_and_timetables', 'measurement_financial'),
  ('money_and_financial_mathematics', 'measurement_financial'),
  ('area_and_perimeter', 'measurement_financial'),
  ('volume_and_capacity', 'measurement_financial'),
  ('unit_conversion', 'measurement_financial'),
  ('two_d_shapes_and_properties', 'geometry_spatial'),
  ('angles', 'geometry_spatial'),
  ('symmetry_and_transformations', 'geometry_spatial'),
  ('coordinates_and_direction', 'geometry_spatial'),
  ('three_d_shapes_nets_and_views', 'geometry_spatial'),
  ('tables_and_data_interpretation', 'data_probability'),
  ('charts_and_graphs', 'data_probability'),
  ('statistics_and_averages', 'data_probability'),
  ('probability', 'data_probability'),
  ('identifying_conclusions_and_claims', 'arguments_evidence'),
  ('identifying_assumptions', 'arguments_evidence'),
  ('strengthening_arguments', 'arguments_evidence'),
  ('weakening_arguments', 'arguments_evidence'),
  ('identifying_flaws', 'arguments_evidence'),
  ('cause_and_effect', 'arguments_evidence'),
  ('correlation_and_causation', 'arguments_evidence'),
  ('evaluating_evidence', 'arguments_evidence'),
  ('experiments_and_fair_testing', 'arguments_evidence'),
  ('sampling_and_bias', 'arguments_evidence'),
  ('drawing_conclusions', 'logic_deduction'),
  ('conditional_logic', 'logic_deduction'),
  ('necessary_and_sufficient_conditions', 'logic_deduction'),
  ('ordering_and_ranking', 'logic_deduction'),
  ('sequencing', 'logic_deduction'),
  ('scheduling_and_timetables', 'logic_deduction'),
  ('logic_grids_and_matching_constraints', 'logic_deduction'),
  ('set_and_venn_logic', 'logic_deduction'),
  ('truth_and_lies', 'logic_deduction'),
  ('information_sufficiency', 'logic_deduction'),
  ('quantitative_logic', 'quantitative_data_reasoning'),
  ('numerical_relationships', 'quantitative_data_reasoning'),
  ('tables_and_data_reasoning', 'quantitative_data_reasoning'),
  ('charts_and_graph_reasoning', 'quantitative_data_reasoning'),
  ('optimisation_and_decision_making', 'quantitative_data_reasoning'),
  ('rates_comparisons_and_conversions', 'quantitative_data_reasoning'),
  ('voting_and_allocation_problems', 'quantitative_data_reasoning'),
  ('pattern_recognition', 'abstract_spatial_reasoning'),
  ('shape_and_symbol_sequences', 'abstract_spatial_reasoning'),
  ('codes_and_symbolic_reasoning', 'abstract_spatial_reasoning'),
  ('matrices_and_visual_analogies', 'abstract_spatial_reasoning'),
  ('odd_one_out_and_classification', 'abstract_spatial_reasoning'),
  ('rotation_and_reflection', 'abstract_spatial_reasoning'),
  ('paper_folding', 'abstract_spatial_reasoning'),
  ('two_d_spatial_assembly', 'abstract_spatial_reasoning'),
  ('three_d_views_and_nets', 'abstract_spatial_reasoning');

-- Store the canonical domain for every row whose subtopic is known. NULL-safe
-- comparison so only rows that actually differ (NULL or stale) are touched.
update public.questions q
set domain_code = m.domain_code,
    updated_at = now()
from _subtopic_domain m
where q.subtopic_code = m.subtopic_code
  and q.domain_code is distinct from m.domain_code;

-- Self-validation guard: after the repair, no question whose subtopic is known to
-- the taxonomy may still carry a domain_code that disagrees with it. If this
-- raises, the map above has drifted from the canonical taxonomy and the migration
-- must be regenerated before being applied.
do $$
declare
  offending int;
begin
  select count(*) into offending
  from public.questions q
  join _subtopic_domain m on m.subtopic_code = q.subtopic_code
  where q.domain_code is distinct from m.domain_code;

  if offending > 0 then
    raise exception
      'domain_code still inconsistent with subtopic_code for % question(s) after backfill', offending;
  end if;
end $$;

commit;
