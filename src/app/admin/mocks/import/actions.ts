'use server'

import { revalidatePath } from 'next/cache'

import { requireProfile } from '@/lib/auth/require-profile'
import { parseImportPackage } from '@/lib/import/asset-package'
import { applyMockImport } from '@/lib/mock-import/apply'
import { parseMockCsv } from '@/lib/mock-import/csv-parser'
import { buildMockExportCsv } from '@/lib/mock-import/export'
import { validateMockImport } from '@/lib/mock-import/validation'
import type {
  MockImportMode,
  MockImportSettings,
  MockImportSummary,
  MockImportValidationResult,
  UploadedAssetFile,
} from '@/lib/mock-import/types'
import { MOCK_EXPORT_MODES, type MockExportMode } from '@/lib/mock-import/schema'
import { getMockBlueprintById } from '@/lib/mock-blueprints/queries'
import type { MockBlueprint } from '@/lib/mock-blueprints/types'
import { ADMIN_PORTAL_ROLES, EXAM_TYPES, type ActionResult, type ExamType } from '@/lib/types'

interface ParsedRequest {
  csvText: string
  assetFiles: Map<string, UploadedAssetFile>
  packageErrors: string[]
  filename: string
}

/** Read the CSV + optional assets ZIP from the three supported upload shapes. */
async function parseRequest(formData: FormData): Promise<ParsedRequest> {
  const packageFile = formData.get('package')
  const csvFile = formData.get('csvFile')
  const assetsZipFile = formData.get('assetsZip')

  if (packageFile instanceof File) {
    const zipBuffer = Buffer.from(await packageFile.arrayBuffer())
    const parsed = await parseImportPackage({ zipBuffer })
    return { csvText: parsed.csvText, assetFiles: parsed.assetFiles, packageErrors: parsed.errors, filename: packageFile.name }
  }
  if (csvFile instanceof File) {
    const csvText = await csvFile.text()
    const extraZipBuffer = assetsZipFile instanceof File ? Buffer.from(await assetsZipFile.arrayBuffer()) : undefined
    const parsed = await parseImportPackage({ csvText, extraZipBuffer })
    return { csvText: parsed.csvText, assetFiles: parsed.assetFiles, packageErrors: parsed.errors, filename: csvFile.name }
  }

  const rawText = String(formData.get('csvText') ?? '')
  return { csvText: rawText, assetFiles: new Map(), packageErrors: [], filename: 'mock.csv' }
}

interface RequestSettings {
  mode: MockImportMode
  examType: ExamType
  alsoAddToBank: boolean
  enforceBlueprint: boolean
  blueprintId: string | null
}

function parseSettings(formData: FormData): RequestSettings {
  const modeRaw = String(formData.get('mode') ?? 'create')
  const examTypeRaw = String(formData.get('examType') ?? 'Selective')
  return {
    mode: modeRaw === 'update' ? 'update' : 'create',
    examType: (EXAM_TYPES as readonly string[]).includes(examTypeRaw) ? (examTypeRaw as ExamType) : 'Selective',
    alsoAddToBank: String(formData.get('alsoAddToBank') ?? '') === 'true',
    enforceBlueprint: String(formData.get('enforceBlueprint') ?? '') === 'true',
    blueprintId: String(formData.get('blueprintId') ?? '').trim() || null,
  }
}

async function loadBlueprint(blueprintId: string | null): Promise<MockBlueprint | null> {
  if (!blueprintId) return null
  try {
    return await getMockBlueprintById(blueprintId)
  } catch {
    return null
  }
}

async function buildValidation(formData: FormData): Promise<{
  validation: MockImportValidationResult
  settings: RequestSettings
  assetFiles: Map<string, UploadedAssetFile>
  packageErrors: string[]
  filename: string
}> {
  const { csvText, assetFiles, packageErrors, filename } = await parseRequest(formData)
  const settings = parseSettings(formData)

  const parsed = parseMockCsv(csvText)
  if (parsed.error) {
    return {
      validation: emptyValidation(parsed.error),
      settings,
      assetFiles,
      packageErrors,
      filename,
    }
  }

  const blueprint = await loadBlueprint(settings.blueprintId)
  const validation = await validateMockImport(parsed.rows, {
    mode: settings.mode,
    assetFiles,
    blueprint,
    examType: settings.examType,
  })
  return { validation, settings, assetFiles, packageErrors, filename }
}

function emptyValidation(parseError: string): MockImportValidationResult {
  return {
    mockExternalId: null,
    mockName: null,
    totalRows: 0,
    importableCount: 0,
    readyCount: 0,
    warningCount: 0,
    errorCount: 0,
    newQuestionCount: 0,
    referencedQuestionCount: 0,
    missingAssetCount: 0,
    duplicateOrderIndexes: [],
    matchesExistingMock: false,
    existingMockId: null,
    rows: [],
    unusedAssetFiles: [],
    blueprint: null,
    parseError,
  }
}

export async function previewMockImportAction(
  formData: FormData
): Promise<ActionResult<MockImportValidationResult>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  try {
    const { validation, packageErrors } = await buildValidation(formData)
    if (validation.parseError) {
      return { success: false, message: validation.parseError, data: validation }
    }
    const message = packageErrors.length > 0 ? packageErrors.join(' ') : undefined
    return { success: true, data: validation, message }
  } catch (caught) {
    return { success: false, message: caught instanceof Error ? caught.message : 'Unable to validate the mock CSV.' }
  }
}

export async function importMockAction(formData: FormData): Promise<ActionResult<MockImportSummary>> {
  const profile = await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  try {
    const { validation, settings, assetFiles } = await buildValidation(formData)
    if (validation.parseError) {
      return { success: false, message: validation.parseError }
    }
    if (validation.importableCount === 0) {
      return { success: false, message: 'No valid rows to import — fix the row errors and try again.' }
    }

    const summary = await applyMockImport({
      validation,
      settings: {
        mode: settings.mode,
        alsoAddToBank: settings.alsoAddToBank,
        questionStatus: 'draft',
        enforceBlueprint: settings.enforceBlueprint,
      } satisfies MockImportSettings,
      assetFiles,
      actorId: profile.id,
      blueprintId: settings.blueprintId,
      examType: settings.examType,
    })

    revalidatePath('/admin/mocks')
    revalidatePath(`/admin/mocks/${summary.mockTestId}`)
    revalidatePath('/admin/questions')

    const verb = summary.created ? 'created' : 'updated'
    return {
      success: true,
      data: summary,
      message: `Mock ${verb}: ${summary.questionsCreated} new question${
        summary.questionsCreated === 1 ? '' : 's'
      }, ${summary.questionsReferenced} referenced. Imported as a draft — review, then publish.`,
    }
  } catch (caught) {
    return { success: false, message: caught instanceof Error ? caught.message : 'Unable to import the mock.' }
  }
}

export async function exportMockCsvAction(
  mockTestId: string,
  mode: MockExportMode
): Promise<ActionResult<{ csv: string; filename: string }>> {
  await requireProfile({ allowedRoles: [...ADMIN_PORTAL_ROLES] })
  if (!(MOCK_EXPORT_MODES as readonly string[]).includes(mode)) {
    return { success: false, message: 'Unknown export mode.' }
  }
  try {
    const csv = await buildMockExportCsv(mockTestId, mode)
    if (csv === null) {
      return { success: false, message: 'Mock not found.' }
    }
    return { success: true, data: { csv, filename: `mock-${mockTestId.slice(0, 8)}-${mode}.csv` } }
  } catch (caught) {
    return { success: false, message: caught instanceof Error ? caught.message : 'Unable to export the mock.' }
  }
}
