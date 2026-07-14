/**
 * Canonical Question Taxonomy — v1 (single source of truth).
 *
 * This module is the ONE place the platform's learning taxonomy lives. Everything
 * else (admin form, question-bank filters, CSV import/export, coverage, mastery,
 * analytics) must read from here rather than hard-coding taxonomy strings.
 *
 * Core learning hierarchy:  Subject → Domain → Subtopic → Skill
 * Separate metadata dimensions (NOT part of the learning hierarchy):
 *   Question family · Stimulus type · Stimulus genre · Response format ·
 *   Difficulty · Pattern key · Tags · Asset render method · Writing metadata
 *
 * Design rules (see docs/question-taxonomy-v1.md):
 *  - Every subject/domain/subtopic/skill has a STABLE machine-readable `code`.
 *    Never persist mutable display labels as identifiers — persist the code.
 *  - Codes are globally unique within the learning hierarchy.
 *  - Question format, text genre and image/stimulus type are NOT subtopics.
 *  - Legacy values map into canonical codes non-destructively; unknown values are
 *    surfaced for review, never silently discarded.
 *
 * This file intentionally has NO runtime imports so it can be unit-tested in
 * isolation (node --test --experimental-strip-types).
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface TaxonomyNodeBase {
  /** Stable, machine-readable identifier. Persist this, never the label. */
  code: string
  /** Human-readable display label. */
  label: string
  /** Ordering within the parent. */
  sortOrder: number
  /** Whether students may see/choose this node in the student portal. */
  studentVisible: boolean
  /** Whether admins/authors may see/choose this node in the admin portal. */
  adminVisible: boolean
}

export interface SkillNode extends TaxonomyNodeBase {
  level: 'skill'
  subtopicCode: string
  domainCode: string
  subjectCode: string
}

export interface SubtopicNode extends TaxonomyNodeBase {
  level: 'subtopic'
  domainCode: string
  subjectCode: string
  skills: SkillNode[]
}

export interface DomainNode extends TaxonomyNodeBase {
  level: 'domain'
  subjectCode: string
  subtopics: SubtopicNode[]
}

export interface SubjectNode extends TaxonomyNodeBase {
  level: 'subject'
  domains: DomainNode[]
}

export type TaxonomyLevel = 'subject' | 'domain' | 'subtopic' | 'skill'

/** A single validated taxonomy assignment for a question. */
export interface TaxonomySelection {
  subjectCode?: string | null
  domainCode?: string | null
  subtopicCode?: string | null
  skillCode?: string | null
}

export interface ValidationIssue {
  field: 'subject' | 'domain' | 'subtopic' | 'skill'
  code: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

/* -------------------------------------------------------------------------- */
/* Raw taxonomy definition                                                     */
/* -------------------------------------------------------------------------- */

/** [code, label] tuples keep the definition compact and readable. */
type Tuple = readonly [code: string, label: string]

interface RawSubject {
  code: string
  label: string
  studentVisible: boolean
  domains: RawDomain[]
}
interface RawDomain {
  code: string
  label: string
  subtopics: RawSubtopic[]
}
interface RawSubtopic {
  code: string
  label: string
  skills?: Tuple[]
}

const RAW_TAXONOMY: RawSubject[] = [
  {
    code: 'reading',
    label: 'Reading',
    studentVisible: true,
    domains: [
      {
        code: 'comprehension_comparison',
        label: 'Comprehension and Comparison',
        subtopics: [
          { code: 'single_extract_comprehension', label: 'Single extract comprehension' },
          { code: 'paired_extract_comparison', label: 'Paired extract comparison' },
          { code: 'multiple_extract_matching', label: 'Multiple extract matching' },
          { code: 'main_idea_and_theme', label: 'Main idea and theme' },
          { code: 'character_setting_and_events', label: 'Character, setting and events' },
          { code: 'author_purpose_and_audience', label: 'Author purpose and audience' },
          { code: 'tone_attitude_and_viewpoint', label: 'Tone, attitude and viewpoint' },
          { code: 'language_techniques', label: 'Language techniques' },
          { code: 'inference_and_drawing_conclusions', label: 'Inference and drawing conclusions' },
          { code: 'vocabulary_in_context', label: 'Vocabulary in context' },
          { code: 'evidence_and_information_retrieval', label: 'Evidence and information retrieval' },
        ],
      },
      {
        code: 'cloze_language',
        label: 'Cloze and Language',
        subtopics: [
          { code: 'vocabulary_and_precise_word_choice', label: 'Vocabulary and precise word choice' },
          { code: 'grammar_and_usage', label: 'Grammar and usage' },
          { code: 'connectives_and_cohesion', label: 'Connectives and cohesion' },
          { code: 'collocations_and_common_expressions', label: 'Collocations and common expressions' },
          { code: 'meaning_from_context', label: 'Meaning from context' },
        ],
      },
      {
        code: 'poetry',
        label: 'Poetry',
        subtopics: [
          { code: 'poetry_meaning_and_theme', label: 'Meaning and theme' },
          { code: 'poetry_imagery_and_figurative_language', label: 'Imagery and figurative language' },
          { code: 'poetry_tone_and_mood', label: 'Tone and mood' },
          { code: 'poetry_speaker_and_perspective', label: 'Speaker and perspective' },
          { code: 'poetry_structure_and_form', label: 'Structure and form' },
          { code: 'poetry_sound_and_rhythm', label: 'Sound and rhythm' },
        ],
      },
      {
        code: 'text_structure_cohesion',
        label: 'Text Structure and Cohesion',
        subtopics: [
          { code: 'sentence_insertion', label: 'Sentence insertion' },
          { code: 'paragraph_heading_matching', label: 'Paragraph heading matching' },
          { code: 'paragraph_summarisation', label: 'Paragraph summarisation' },
          { code: 'sequencing_and_organisation', label: 'Sequencing and organisation' },
          { code: 'cohesion_across_a_text', label: 'Cohesion across a text' },
        ],
      },
    ],
  },
  {
    code: 'mathematical_reasoning',
    label: 'Mathematical Reasoning',
    studentVisible: true,
    domains: [
      {
        code: 'number_algebra',
        label: 'Number and Algebra',
        subtopics: [
          { code: 'arithmetic_number_reasoning', label: 'Arithmetic and number reasoning' },
          { code: 'place_value_and_rounding', label: 'Place value and rounding' },
          { code: 'factors_multiples_and_divisibility', label: 'Factors, multiples and divisibility' },
          { code: 'fractions', label: 'Fractions' },
          { code: 'decimals', label: 'Decimals' },
          { code: 'percentages', label: 'Percentages' },
          { code: 'ratio_rates_proportion', label: 'Ratio, rates and proportion' },
          { code: 'algebra_and_unknowns', label: 'Algebra and unknowns' },
          { code: 'patterns_and_sequences', label: 'Patterns and sequences' },
          { code: 'counting_and_combinations', label: 'Counting and combinations' },
        ],
      },
      {
        code: 'measurement_financial',
        label: 'Measurement and Financial Mathematics',
        subtopics: [
          { code: 'length_mass_capacity', label: 'Length, mass and capacity' },
          { code: 'time_and_timetables', label: 'Time and timetables' },
          { code: 'money_and_financial_mathematics', label: 'Money and financial mathematics' },
          {
            code: 'area_and_perimeter',
            label: 'Area and perimeter',
            skills: [
              ['rectangle_area', 'Rectangle area'],
              ['composite_area', 'Composite area'],
              ['missing_side_length', 'Missing side length'],
              ['basic_perimeter', 'Basic perimeter'],
              ['composite_perimeter', 'Composite perimeter'],
              ['comparing_area_and_perimeter', 'Comparing area and perimeter'],
              ['area_with_algebra', 'Area with algebra'],
              ['perimeter_with_algebra', 'Perimeter with algebra'],
            ],
          },
          { code: 'volume_and_capacity', label: 'Volume and capacity' },
          { code: 'unit_conversion', label: 'Unit conversion' },
        ],
      },
      {
        code: 'geometry_spatial',
        label: 'Geometry and Spatial Reasoning',
        subtopics: [
          { code: 'two_d_shapes_and_properties', label: '2D shapes and properties' },
          { code: 'angles', label: 'Angles' },
          { code: 'symmetry_and_transformations', label: 'Symmetry and transformations' },
          { code: 'coordinates_and_direction', label: 'Coordinates and direction' },
          { code: 'three_d_shapes_nets_and_views', label: '3D shapes, nets and views' },
        ],
      },
      {
        code: 'data_probability',
        label: 'Data and Probability',
        subtopics: [
          { code: 'tables_and_data_interpretation', label: 'Tables and data interpretation' },
          { code: 'charts_and_graphs', label: 'Charts and graphs' },
          { code: 'statistics_and_averages', label: 'Statistics and averages' },
          { code: 'probability', label: 'Probability' },
        ],
      },
    ],
  },
  {
    code: 'thinking_skills',
    label: 'Thinking Skills',
    studentVisible: true,
    domains: [
      {
        code: 'arguments_evidence',
        label: 'Arguments and Evidence',
        subtopics: [
          { code: 'identifying_conclusions_and_claims', label: 'Identifying conclusions and claims' },
          { code: 'identifying_assumptions', label: 'Identifying assumptions' },
          { code: 'strengthening_arguments', label: 'Strengthening arguments' },
          { code: 'weakening_arguments', label: 'Weakening arguments' },
          { code: 'identifying_flaws', label: 'Identifying flaws' },
          { code: 'cause_and_effect', label: 'Cause and effect' },
          { code: 'correlation_and_causation', label: 'Correlation and causation' },
          { code: 'evaluating_evidence', label: 'Evaluating evidence' },
          { code: 'experiments_and_fair_testing', label: 'Experiments and fair testing' },
          { code: 'sampling_and_bias', label: 'Sampling and bias' },
        ],
      },
      {
        code: 'logic_deduction',
        label: 'Logic and Deduction',
        subtopics: [
          { code: 'drawing_conclusions', label: 'Drawing conclusions' },
          { code: 'conditional_logic', label: 'Conditional logic' },
          { code: 'necessary_and_sufficient_conditions', label: 'Necessary and sufficient conditions' },
          { code: 'ordering_and_ranking', label: 'Ordering and ranking' },
          { code: 'sequencing', label: 'Sequencing' },
          { code: 'scheduling_and_timetables', label: 'Scheduling and timetables' },
          { code: 'logic_grids_and_matching_constraints', label: 'Logic grids and matching constraints' },
          { code: 'set_and_venn_logic', label: 'Set and Venn logic' },
          { code: 'truth_and_lies', label: 'Truth and lies' },
          { code: 'information_sufficiency', label: 'Information sufficiency' },
        ],
      },
      {
        code: 'quantitative_data_reasoning',
        label: 'Quantitative and Data Reasoning',
        subtopics: [
          { code: 'quantitative_logic', label: 'Quantitative logic' },
          { code: 'numerical_relationships', label: 'Numerical relationships' },
          { code: 'tables_and_data_reasoning', label: 'Tables and data reasoning' },
          { code: 'charts_and_graph_reasoning', label: 'Charts and graph reasoning' },
          { code: 'optimisation_and_decision_making', label: 'Optimisation and decision-making' },
          { code: 'rates_comparisons_and_conversions', label: 'Rates, comparisons and conversions' },
          { code: 'voting_and_allocation_problems', label: 'Voting and allocation problems' },
        ],
      },
      {
        code: 'abstract_spatial_reasoning',
        label: 'Abstract and Spatial Reasoning',
        subtopics: [
          { code: 'pattern_recognition', label: 'Pattern recognition' },
          { code: 'shape_and_symbol_sequences', label: 'Shape and symbol sequences' },
          { code: 'codes_and_symbolic_reasoning', label: 'Codes and symbolic reasoning' },
          { code: 'matrices_and_visual_analogies', label: 'Matrices and visual analogies' },
          { code: 'odd_one_out_and_classification', label: 'Odd one out and classification' },
          { code: 'rotation_and_reflection', label: 'Rotation and reflection' },
          { code: 'paper_folding', label: 'Paper folding' },
          { code: 'two_d_spatial_assembly', label: '2D spatial assembly' },
          { code: 'three_d_views_and_nets', label: '3D views and nets' },
        ],
      },
    ],
  },
  {
    // Writing is admin-only for now: not exposed as a student practice category.
    // Its finer categorisation lives in the writing metadata dimensions below
    // (writing form / purpose / prompt stimulus), NOT as domains/subtopics.
    code: 'writing',
    label: 'Writing',
    studentVisible: false,
    domains: [],
  },
]

/* -------------------------------------------------------------------------- */
/* Build the typed tree + lookup indexes                                       */
/* -------------------------------------------------------------------------- */

function buildTree(raw: RawSubject[]): SubjectNode[] {
  return raw.map((subject, subjectIndex) => {
    const subjectNode: SubjectNode = {
      level: 'subject',
      code: subject.code,
      label: subject.label,
      sortOrder: subjectIndex + 1,
      studentVisible: subject.studentVisible,
      adminVisible: true,
      domains: subject.domains.map((domain, domainIndex) => {
        const domainNode: DomainNode = {
          level: 'domain',
          code: domain.code,
          label: domain.label,
          sortOrder: domainIndex + 1,
          studentVisible: subject.studentVisible,
          adminVisible: true,
          subjectCode: subject.code,
          subtopics: domain.subtopics.map((subtopic, subtopicIndex) => {
            const subtopicNode: SubtopicNode = {
              level: 'subtopic',
              code: subtopic.code,
              label: subtopic.label,
              sortOrder: subtopicIndex + 1,
              studentVisible: subject.studentVisible,
              adminVisible: true,
              domainCode: domain.code,
              subjectCode: subject.code,
              skills: (subtopic.skills ?? []).map(([code, label], skillIndex) => ({
                level: 'skill',
                code,
                label,
                sortOrder: skillIndex + 1,
                studentVisible: subject.studentVisible,
                adminVisible: true,
                subtopicCode: subtopic.code,
                domainCode: domain.code,
                subjectCode: subject.code,
              })),
            }
            return subtopicNode
          }),
        }
        return domainNode
      }),
    }
    return subjectNode
  })
}

export const TAXONOMY: SubjectNode[] = buildTree(RAW_TAXONOMY)

const subjectByCode = new Map<string, SubjectNode>()
const domainByCode = new Map<string, DomainNode>()
const subtopicByCode = new Map<string, SubtopicNode>()
const skillByCode = new Map<string, SkillNode>()

for (const subject of TAXONOMY) {
  subjectByCode.set(subject.code, subject)
  for (const domain of subject.domains) {
    domainByCode.set(domain.code, domain)
    for (const subtopic of domain.subtopics) {
      subtopicByCode.set(subtopic.code, subtopic)
      for (const skill of subtopic.skills) {
        skillByCode.set(skill.code, skill)
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Hierarchy helper functions                                                  */
/* -------------------------------------------------------------------------- */

export function getSubjects(): SubjectNode[] {
  return TAXONOMY
}

export function getStudentVisibleSubjects(): SubjectNode[] {
  return TAXONOMY.filter((subject) => subject.studentVisible)
}

export function getAdminVisibleSubjects(): SubjectNode[] {
  return TAXONOMY.filter((subject) => subject.adminVisible)
}

export function getSubject(code: string | null | undefined): SubjectNode | null {
  return code ? subjectByCode.get(code) ?? null : null
}

export function getDomain(code: string | null | undefined): DomainNode | null {
  return code ? domainByCode.get(code) ?? null : null
}

export function getSubtopic(code: string | null | undefined): SubtopicNode | null {
  return code ? subtopicByCode.get(code) ?? null : null
}

export function getSkill(code: string | null | undefined): SkillNode | null {
  return code ? skillByCode.get(code) ?? null : null
}

/** Domains available for a subject. */
export function getDomainsForSubject(subjectCode: string | null | undefined): DomainNode[] {
  return getSubject(subjectCode)?.domains ?? []
}

/** Subtopics available for a domain. */
export function getSubtopicsForDomain(domainCode: string | null | undefined): SubtopicNode[] {
  return getDomain(domainCode)?.subtopics ?? []
}

/** Suggested skills for a subtopic (may be empty — skills are used where useful). */
export function getSuggestedSkillsForSubtopic(subtopicCode: string | null | undefined): SkillNode[] {
  return getSubtopic(subtopicCode)?.skills ?? []
}

/** Subtopic codes belonging to a domain (empty for an unknown domain). */
export function getSubtopicCodesForDomain(domainCode: string | null | undefined): string[] {
  return getSubtopicsForDomain(domainCode).map((subtopic) => subtopic.code)
}

/**
 * The canonical domain a question belongs to.
 *
 * A question's subtopic is its most specific placement, so a valid subtopic's
 * parent domain ALWAYS wins over any separately-stored domain code. This mirrors
 * exactly how the student mastery/coverage views place a question (they group by
 * `subtopic_code` and read `getSubtopic(code).domainCode`). Only when there is no
 * usable subtopic do we fall back to the stored domain code. Keeping this in one
 * place is what guarantees admin filtering and student grouping agree.
 */
export function resolveCanonicalDomainCode(
  selection: Pick<TaxonomySelection, 'domainCode' | 'subtopicCode'>
): string | null {
  const fromSubtopic = getSubtopic(selection.subtopicCode)?.domainCode
  if (fromSubtopic) return fromSubtopic
  return selection.domainCode ?? null
}

/** All domains, flat. */
export function getAllDomains(): DomainNode[] {
  return [...domainByCode.values()]
}

/** All subtopics, flat. */
export function getAllSubtopics(): SubtopicNode[] {
  return [...subtopicByCode.values()]
}

/** All skills, flat. */
export function getAllSkills(): SkillNode[] {
  return [...skillByCode.values()]
}

/* -------------------------------------------------------------------------- */
/* Display labels                                                              */
/* -------------------------------------------------------------------------- */

export function getSubjectLabel(code: string | null | undefined): string | null {
  return getSubject(code)?.label ?? null
}
export function getDomainLabel(code: string | null | undefined): string | null {
  return getDomain(code)?.label ?? null
}
export function getSubtopicLabel(code: string | null | undefined): string | null {
  return getSubtopic(code)?.label ?? null
}
export function getSkillLabel(code: string | null | undefined): string | null {
  return getSkill(code)?.label ?? null
}

/** Look up a display label for any tree code, regardless of level. */
export function getLabelForCode(code: string | null | undefined): string | null {
  if (!code) return null
  return (
    getSubject(code)?.label ??
    getDomain(code)?.label ??
    getSubtopic(code)?.label ??
    getSkill(code)?.label ??
    null
  )
}

/** A breadcrumb like "Mathematical Reasoning › Measurement… › Area and perimeter". */
export function getBreadcrumb(selection: TaxonomySelection): string {
  const parts = [
    getSubjectLabel(selection.subjectCode),
    getDomainLabel(selection.domainCode),
    getSubtopicLabel(selection.subtopicCode),
    getSkillLabel(selection.skillCode),
  ].filter((part): part is string => Boolean(part))
  return parts.join(' › ')
}

/* -------------------------------------------------------------------------- */
/* Validation of combinations                                                  */
/* -------------------------------------------------------------------------- */

export function isValidDomainForSubject(subjectCode: string, domainCode: string): boolean {
  return getDomain(domainCode)?.subjectCode === subjectCode
}
export function isValidSubtopicForDomain(domainCode: string, subtopicCode: string): boolean {
  return getSubtopic(subtopicCode)?.domainCode === domainCode
}
export function isValidSkillForSubtopic(subtopicCode: string, skillCode: string): boolean {
  return getSkill(skillCode)?.subtopicCode === subtopicCode
}

/**
 * Validate a Subject → Domain → Subtopic → Skill selection.
 * Each level is optional, but a provided level must exist AND be consistent with
 * the level above it. Skill is always optional ("where appropriate").
 */
export function validateCombination(selection: TaxonomySelection): ValidationResult {
  const issues: ValidationIssue[] = []
  const { subjectCode, domainCode, subtopicCode, skillCode } = selection

  if (subjectCode && !getSubject(subjectCode)) {
    issues.push({ field: 'subject', code: subjectCode, message: `Unknown subject code "${subjectCode}".` })
  }

  if (domainCode) {
    const domain = getDomain(domainCode)
    if (!domain) {
      issues.push({ field: 'domain', code: domainCode, message: `Unknown domain code "${domainCode}".` })
    } else if (subjectCode && domain.subjectCode !== subjectCode) {
      issues.push({
        field: 'domain',
        code: domainCode,
        message: `Domain "${domainCode}" does not belong to subject "${subjectCode}".`,
      })
    }
  }

  if (subtopicCode) {
    const subtopic = getSubtopic(subtopicCode)
    if (!subtopic) {
      issues.push({ field: 'subtopic', code: subtopicCode, message: `Unknown subtopic code "${subtopicCode}".` })
    } else {
      if (domainCode && subtopic.domainCode !== domainCode) {
        issues.push({
          field: 'subtopic',
          code: subtopicCode,
          message: `Subtopic "${subtopicCode}" does not belong to domain "${domainCode}".`,
        })
      }
      if (subjectCode && subtopic.subjectCode !== subjectCode) {
        issues.push({
          field: 'subtopic',
          code: subtopicCode,
          message: `Subtopic "${subtopicCode}" does not belong to subject "${subjectCode}".`,
        })
      }
    }
  }

  if (skillCode) {
    const skill = getSkill(skillCode)
    if (!skill) {
      issues.push({ field: 'skill', code: skillCode, message: `Unknown skill code "${skillCode}".` })
    } else if (subtopicCode && skill.subtopicCode !== subtopicCode) {
      issues.push({
        field: 'skill',
        code: skillCode,
        message: `Skill "${skillCode}" does not belong to subtopic "${subtopicCode}".`,
      })
    }
  }

  return { valid: issues.length === 0, issues }
}

/* -------------------------------------------------------------------------- */
/* Metadata dimensions (kept separate from the learning hierarchy)             */
/* -------------------------------------------------------------------------- */

export interface DimensionItem {
  code: string
  label: string
}

function dim(items: Tuple[]): DimensionItem[] {
  return items.map(([code, label]) => ({ code, label }))
}

/** Question family — the structural "shape" of the task (NOT a subtopic). */
export const QUESTION_FAMILIES = dim([
  ['standard_multiple_choice', 'Standard multiple choice'],
  ['cloze_multiple_choice', 'Cloze multiple choice'],
  ['sentence_insertion', 'Sentence insertion'],
  ['paragraph_heading_matching', 'Paragraph heading matching'],
  ['extract_matching', 'Extract matching'],
  ['written_response', 'Written response'],
  ['extended_writing_task', 'Extended writing task'],
])

/** Stimulus type — what kind of stimulus a question carries (NOT a subtopic). */
export const STIMULUS_FORMATS = dim([
  ['none', 'None'],
  ['single_text', 'Single text'],
  ['paired_texts', 'Paired texts'],
  ['multiple_extracts', 'Multiple extracts'],
  ['poem', 'Poem'],
  ['image_or_illustration', 'Image or illustration'],
  ['mathematical_diagram', 'Mathematical diagram'],
  ['table', 'Table'],
  ['bar_chart', 'Bar chart'],
  ['line_graph', 'Line graph'],
  ['pie_chart', 'Pie chart'],
  ['map', 'Map'],
  ['number_line', 'Number line'],
  ['coordinate_grid', 'Coordinate grid'],
  ['matrix', 'Matrix'],
  ['visual_sequence', 'Visual sequence'],
  ['two_d_shape', '2D shape'],
  ['three_d_shape', '3D shape'],
  ['net', 'Net'],
  ['mixed_stimulus', 'Mixed stimulus'],
])

/** Reading stimulus genre — the text type of a Reading stimulus (NOT a subtopic). */
export const STIMULUS_GENRES = dim([
  ['narrative_fiction', 'Narrative fiction'],
  ['memoir_or_autobiography', 'Memoir or autobiography'],
  ['informative_text', 'Informative text'],
  ['persuasive_or_opinion_text', 'Persuasive or opinion text'],
  ['article_or_report', 'Article or report'],
  ['poetry', 'Poetry'],
  ['mixed_extracts', 'Mixed extracts'],
])

/** How an asset for a question is produced/rendered. */
export const ASSET_RENDER_METHODS = dim([
  ['rich_text', 'Rich text'],
  ['latex', 'LaTeX'],
  ['structured_table', 'Structured table'],
  ['structured_chart', 'Structured chart'],
  ['deterministic_svg', 'Deterministic SVG'],
  ['uploaded_image', 'Uploaded image'],
  ['external_asset_reference', 'External asset reference'],
])

/** Writing form (admin metadata). */
export const WRITING_FORMS = dim([
  ['narrative', 'Narrative'],
  ['diary_entry', 'Diary entry'],
  ['newspaper_report', 'Newspaper report'],
  ['article', 'Article'],
  ['advice_sheet', 'Advice sheet'],
  ['letter_or_email', 'Letter or email'],
  ['speech', 'Speech'],
  ['review', 'Review'],
  ['description', 'Description'],
  ['persuasive_response', 'Persuasive response'],
  ['informative_response', 'Informative response'],
])

/** Writing purpose (admin metadata). */
export const WRITING_PURPOSES = dim([
  ['inform', 'Inform'],
  ['persuade', 'Persuade'],
  ['entertain', 'Entertain'],
  ['describe', 'Describe'],
  ['reflect', 'Reflect'],
  ['advise', 'Advise'],
])

/** Writing prompt stimulus (admin metadata). */
export const WRITING_PROMPT_STIMULI = dim([
  ['scenario', 'Scenario'],
  ['image', 'Image'],
  ['title', 'Title'],
  ['theme', 'Theme'],
  ['opening_sentence', 'Opening sentence'],
  ['audience_and_purpose', 'Audience and purpose'],
  ['combination_prompt', 'Combination prompt'],
])

const DIMENSIONS = {
  question_family: QUESTION_FAMILIES,
  stimulus_format: STIMULUS_FORMATS,
  stimulus_genre: STIMULUS_GENRES,
  asset_render_method: ASSET_RENDER_METHODS,
  writing_form: WRITING_FORMS,
  writing_purpose: WRITING_PURPOSES,
  writing_prompt_stimulus: WRITING_PROMPT_STIMULI,
} as const

export type DimensionName = keyof typeof DIMENSIONS

/** True when `code` is a valid value for the named dimension (null/'' is allowed). */
export function isValidDimensionValue(dimension: DimensionName, code: string | null | undefined): boolean {
  if (!code) return true
  return DIMENSIONS[dimension].some((item) => item.code === code)
}

/** Display label for a dimension value (falls back to the raw code). */
export function getDimensionLabel(dimension: DimensionName, code: string | null | undefined): string | null {
  if (!code) return null
  return DIMENSIONS[dimension].find((item) => item.code === code)?.label ?? code
}

/** Build a `{ code: label }` map for a dimension — handy for Base UI `<Select items>`. */
export function dimensionItemsMap(dimension: DimensionName): Record<string, string> {
  return Object.fromEntries(DIMENSIONS[dimension].map((item) => [item.code, item.label]))
}

/* -------------------------------------------------------------------------- */
/* Legacy mappings (non-destructive)                                           */
/* -------------------------------------------------------------------------- */

export interface LegacyMapping {
  subjectCode: string
  domainCode?: string
  subtopicCode?: string
  /** For Reading rows where a legacy label is really a stimulus genre. */
  stimulusGenre?: string
  /** Human note explaining a lossy/ambiguous mapping. */
  note?: string
}

/**
 * Normalise a legacy value (slug OR display label) to a comparison key by
 * collapsing everything except a–z/0–9. So "Area & Perimeter", "area-perimeter"
 * and "area_perimeter" all resolve to the same entry.
 */
export function normalizeLegacyKey(value: string): string {
  // Drop every non-alphanumeric character so "Area & Perimeter", "area-perimeter"
  // and "area_perimeter" collapse to the same key. "and" survives only where it is
  // literally spelled in the source (e.g. the slug "strengthen-and-weaken").
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/** Legacy SUBJECT slug/label → canonical subject code. */
const LEGACY_SUBJECTS: Record<string, string> = {
  reading: 'reading',
  mathematicalreasoning: 'mathematical_reasoning',
  maths: 'mathematical_reasoning',
  math: 'mathematical_reasoning',
  thinkingskills: 'thinking_skills',
  writing: 'writing',
  // Legacy "Vocabulary" subject folds into Reading › Cloze and Language.
  vocabulary: 'reading',
}

/**
 * Legacy TOPIC / QUESTION-TYPE slug or label → canonical placement.
 * Keyed by normalizeLegacyKey(...). Values reference canonical codes only.
 * Covers every legacy topic slug seen in the live database plus the spec's
 * documented example mappings.
 */
const LEGACY_TAXONOMY: Record<string, LegacyMapping> = {
  // ---- Reading -----------------------------------------------------------
  narrativeextracts: { subjectCode: 'reading', domainCode: 'comprehension_comparison', subtopicCode: 'single_extract_comprehension', stimulusGenre: 'narrative_fiction' },
  extracts: { subjectCode: 'reading', domainCode: 'comprehension_comparison' },
  narrative: { subjectCode: 'reading', domainCode: 'comprehension_comparison', stimulusGenre: 'narrative_fiction', note: 'Narrative is a stimulus genre, not a Reading subtopic.' },
  pairedextracts: { subjectCode: 'reading', domainCode: 'comprehension_comparison', subtopicCode: 'paired_extract_comparison' },
  poetry: { subjectCode: 'reading', domainCode: 'poetry' },
  clozepassage: { subjectCode: 'reading', domainCode: 'cloze_language' },
  informationtexts: { subjectCode: 'reading', domainCode: 'comprehension_comparison', stimulusGenre: 'informative_text' },
  mainidea: { subjectCode: 'reading', domainCode: 'comprehension_comparison', subtopicCode: 'main_idea_and_theme' },
  inference: { subjectCode: 'reading', domainCode: 'comprehension_comparison', subtopicCode: 'inference_and_drawing_conclusions' },
  vocabularyincontext: { subjectCode: 'reading', domainCode: 'comprehension_comparison', subtopicCode: 'vocabulary_in_context' },
  authorpurpose: { subjectCode: 'reading', domainCode: 'comprehension_comparison', subtopicCode: 'author_purpose_and_audience' },
  detailquestions: { subjectCode: 'reading', domainCode: 'comprehension_comparison', subtopicCode: 'evidence_and_information_retrieval' },
  // Legacy "Vocabulary" subject topics
  synonyms: { subjectCode: 'reading', domainCode: 'cloze_language', subtopicCode: 'vocabulary_and_precise_word_choice' },
  antonyms: { subjectCode: 'reading', domainCode: 'cloze_language', subtopicCode: 'vocabulary_and_precise_word_choice' },
  wordmeaning: { subjectCode: 'reading', domainCode: 'cloze_language', subtopicCode: 'meaning_from_context' },

  // ---- Mathematical Reasoning -------------------------------------------
  arithmetic: { subjectCode: 'mathematical_reasoning', domainCode: 'number_algebra', subtopicCode: 'arithmetic_number_reasoning' },
  arithmeticoperations: { subjectCode: 'mathematical_reasoning', domainCode: 'number_algebra', subtopicCode: 'arithmetic_number_reasoning' },
  fractionsdecimals: { subjectCode: 'mathematical_reasoning', domainCode: 'number_algebra', note: 'Combined legacy topic — pick fractions or decimals when editing.' },
  fractions: { subjectCode: 'mathematical_reasoning', domainCode: 'number_algebra', subtopicCode: 'fractions' },
  decimals: { subjectCode: 'mathematical_reasoning', domainCode: 'number_algebra', subtopicCode: 'decimals' },
  percentages: { subjectCode: 'mathematical_reasoning', domainCode: 'number_algebra', subtopicCode: 'percentages' },
  fractionsdecimalspercentages: { subjectCode: 'mathematical_reasoning', domainCode: 'number_algebra', note: 'Combined legacy topic — choose a specific subtopic when editing.' },
  ratiorates: { subjectCode: 'mathematical_reasoning', domainCode: 'number_algebra', subtopicCode: 'ratio_rates_proportion' },
  ratios: { subjectCode: 'mathematical_reasoning', domainCode: 'number_algebra', subtopicCode: 'ratio_rates_proportion' },
  algebra: { subjectCode: 'mathematical_reasoning', domainCode: 'number_algebra', subtopicCode: 'algebra_and_unknowns' },
  patterns: { subjectCode: 'mathematical_reasoning', domainCode: 'number_algebra', subtopicCode: 'patterns_and_sequences' },
  numberpatterns: { subjectCode: 'mathematical_reasoning', domainCode: 'number_algebra', subtopicCode: 'patterns_and_sequences' },
  area: { subjectCode: 'mathematical_reasoning', domainCode: 'measurement_financial', subtopicCode: 'area_and_perimeter', note: 'Area and Perimeter are one student-facing subtopic; precise concepts are skills.' },
  perimeter: { subjectCode: 'mathematical_reasoning', domainCode: 'measurement_financial', subtopicCode: 'area_and_perimeter', note: 'Area and Perimeter are one student-facing subtopic; precise concepts are skills.' },
  areaperimeter: { subjectCode: 'mathematical_reasoning', domainCode: 'measurement_financial', subtopicCode: 'area_and_perimeter' },
  time: { subjectCode: 'mathematical_reasoning', domainCode: 'measurement_financial', subtopicCode: 'time_and_timetables' },
  money: { subjectCode: 'mathematical_reasoning', domainCode: 'measurement_financial', subtopicCode: 'money_and_financial_mathematics' },
  unitslength: { subjectCode: 'mathematical_reasoning', domainCode: 'measurement_financial', subtopicCode: 'length_mass_capacity' },
  volume: { subjectCode: 'mathematical_reasoning', domainCode: 'measurement_financial', subtopicCode: 'volume_and_capacity' },
  angles: { subjectCode: 'mathematical_reasoning', domainCode: 'geometry_spatial', subtopicCode: 'angles' },
  symmetrytransformations: { subjectCode: 'mathematical_reasoning', domainCode: 'geometry_spatial', subtopicCode: 'symmetry_and_transformations' },
  coordinates: { subjectCode: 'mathematical_reasoning', domainCode: 'geometry_spatial', subtopicCode: 'coordinates_and_direction' },
  geometry: { subjectCode: 'mathematical_reasoning', domainCode: 'geometry_spatial' },
  tablesgraphs: { subjectCode: 'mathematical_reasoning', domainCode: 'data_probability', subtopicCode: 'charts_and_graphs' },
  datainterpretation: { subjectCode: 'mathematical_reasoning', domainCode: 'data_probability', subtopicCode: 'tables_and_data_interpretation' },
  statistics: { subjectCode: 'mathematical_reasoning', domainCode: 'data_probability', subtopicCode: 'statistics_and_averages' },
  probability: { subjectCode: 'mathematical_reasoning', domainCode: 'data_probability', subtopicCode: 'probability' },
  problemsolvingstrategies: { subjectCode: 'mathematical_reasoning', domainCode: 'number_algebra', note: 'Cross-cutting legacy topic — choose a specific subtopic when editing.' },

  // ---- Thinking Skills ---------------------------------------------------
  argumentanalysis: { subjectCode: 'thinking_skills', domainCode: 'arguments_evidence', subtopicCode: 'identifying_conclusions_and_claims' },
  arguments: { subjectCode: 'thinking_skills', domainCode: 'arguments_evidence' },
  argumentreasoning: { subjectCode: 'thinking_skills', domainCode: 'arguments_evidence' },
  assumptions: { subjectCode: 'thinking_skills', domainCode: 'arguments_evidence', subtopicCode: 'identifying_assumptions' },
  strengthenandweaken: { subjectCode: 'thinking_skills', domainCode: 'arguments_evidence', subtopicCode: 'strengthening_arguments' },
  evidencereasoning: { subjectCode: 'thinking_skills', domainCode: 'arguments_evidence', subtopicCode: 'evaluating_evidence' },
  logic: { subjectCode: 'thinking_skills', domainCode: 'logic_deduction' },
  logicaldeduction: { subjectCode: 'thinking_skills', domainCode: 'logic_deduction' },
  deduction: { subjectCode: 'thinking_skills', domainCode: 'logic_deduction' },
  drawingconclusions: { subjectCode: 'thinking_skills', domainCode: 'logic_deduction', subtopicCode: 'drawing_conclusions' },
  orderingsets: { subjectCode: 'thinking_skills', domainCode: 'logic_deduction', subtopicCode: 'ordering_and_ranking' },
  truthpuzzles: { subjectCode: 'thinking_skills', domainCode: 'logic_deduction', subtopicCode: 'truth_and_lies' },
  mathematicalanalysis: { subjectCode: 'thinking_skills', domainCode: 'quantitative_data_reasoning', note: 'Renamed: "Mathematical Analysis" → "Quantitative and Data Reasoning".' },
  problemsolving: { subjectCode: 'thinking_skills', domainCode: 'quantitative_data_reasoning' },
  abstractreasoning: { subjectCode: 'thinking_skills', domainCode: 'abstract_spatial_reasoning' },
  spatialreasoning: { subjectCode: 'thinking_skills', domainCode: 'abstract_spatial_reasoning' },
  patternrecognition: { subjectCode: 'thinking_skills', domainCode: 'abstract_spatial_reasoning', subtopicCode: 'pattern_recognition' },

  // ---- Writing (admin metadata only) ------------------------------------
  imaginativewriting: { subjectCode: 'writing' },
  persuasivediscursivewriting: { subjectCode: 'writing' },
  informativewriting: { subjectCode: 'writing' },
  appliedwriting: { subjectCode: 'writing' },
  grammar: { subjectCode: 'writing' },
  sentencestructure: { subjectCode: 'writing' },
  punctuation: { subjectCode: 'writing' },
  editing: { subjectCode: 'writing' },
  writtenexpression: { subjectCode: 'writing' },
}

/** Legacy writing question-type slug/label → canonical writing form code. */
const LEGACY_WRITING_FORMS: Record<string, string> = {
  narrative: 'narrative',
  description: 'description',
  diaryentry: 'diary_entry',
  recount: 'narrative',
  persuasive: 'persuasive_response',
  discursive: 'persuasive_response',
  speech: 'speech',
  letter: 'letter_or_email',
  informative: 'informative_response',
  newspaperreport: 'newspaper_report',
  advicesheet: 'advice_sheet',
}

export interface LegacyResolution {
  matched: boolean
  mapping: LegacyMapping | null
  /** True when the raw value could not be mapped and needs human review. */
  needsReview: boolean
  raw: string
}

/**
 * Resolve a legacy subject/topic/question-type value (slug OR label) into
 * canonical codes. Never throws and never guesses destructively: an unknown
 * value returns { matched: false, needsReview: true } so callers can surface it.
 */
export function resolveLegacyTaxonomy(rawValue: string | null | undefined): LegacyResolution {
  const raw = (rawValue ?? '').trim()
  if (!raw) {
    return { matched: false, mapping: null, needsReview: false, raw: '' }
  }
  const key = normalizeLegacyKey(raw)

  const direct = LEGACY_TAXONOMY[key]
  if (direct) {
    return { matched: true, mapping: direct, needsReview: false, raw }
  }

  const subjectCode = LEGACY_SUBJECTS[key]
  if (subjectCode) {
    return { matched: true, mapping: { subjectCode }, needsReview: false, raw }
  }

  return { matched: false, mapping: null, needsReview: true, raw }
}

/** Legacy subject slug/label → canonical subject code (or null). */
export function resolveLegacySubject(rawValue: string | null | undefined): string | null {
  const raw = (rawValue ?? '').trim()
  if (!raw) return null
  const key = normalizeLegacyKey(raw)
  return LEGACY_SUBJECTS[key] ?? LEGACY_TAXONOMY[key]?.subjectCode ?? null
}

/** Legacy writing question-type slug/label → canonical writing form (or null). */
export function resolveLegacyWritingForm(rawValue: string | null | undefined): string | null {
  const raw = (rawValue ?? '').trim()
  if (!raw) return null
  return LEGACY_WRITING_FORMS[normalizeLegacyKey(raw)] ?? null
}

/* -------------------------------------------------------------------------- */
/* Student / admin visible views                                               */
/* -------------------------------------------------------------------------- */

/** The taxonomy tree pruned to student-visible nodes. */
export function getStudentVisibleTaxonomy(): SubjectNode[] {
  return TAXONOMY.filter((subject) => subject.studentVisible).map((subject) => ({
    ...subject,
    domains: subject.domains
      .filter((domain) => domain.studentVisible)
      .map((domain) => ({
        ...domain,
        subtopics: domain.subtopics
          .filter((subtopic) => subtopic.studentVisible)
          .map((subtopic) => ({
            ...subtopic,
            skills: subtopic.skills.filter((skill) => skill.studentVisible),
          })),
      })),
  }))
}

/** The taxonomy tree pruned to admin-visible nodes (currently the full tree). */
export function getAdminVisibleTaxonomy(): SubjectNode[] {
  return TAXONOMY.filter((subject) => subject.adminVisible)
}

/* -------------------------------------------------------------------------- */
/* Base UI <Select> item-map helpers                                           */
/* -------------------------------------------------------------------------- */

export function subjectItemsMap(options?: { adminOnly?: boolean }): Record<string, string> {
  const subjects = options?.adminOnly ? getAdminVisibleSubjects() : getStudentVisibleSubjects()
  return Object.fromEntries(subjects.map((subject) => [subject.code, subject.label]))
}
export function domainItemsMap(subjectCode: string | null | undefined): Record<string, string> {
  return Object.fromEntries(getDomainsForSubject(subjectCode).map((domain) => [domain.code, domain.label]))
}
export function subtopicItemsMap(domainCode: string | null | undefined): Record<string, string> {
  return Object.fromEntries(getSubtopicsForDomain(domainCode).map((subtopic) => [subtopic.code, subtopic.label]))
}
export function skillItemsMap(subtopicCode: string | null | undefined): Record<string, string> {
  return Object.fromEntries(getSuggestedSkillsForSubtopic(subtopicCode).map((skill) => [skill.code, skill.label]))
}

/** The canonical taxonomy version this module represents. */
export const TAXONOMY_VERSION = 'v1'
