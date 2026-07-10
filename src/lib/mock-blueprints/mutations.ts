import { normalizeBlueprintSpec } from '@/lib/mock-blueprints/spec'
import { createClient } from '@/lib/supabase/server'
import type { BlueprintStatus, MockBlueprintInput } from '@/lib/mock-blueprints/types'

function toPayload(input: MockBlueprintInput, userId: string) {
  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    exam_type: input.examType,
    subject_code: input.subjectCode?.trim() || null,
    status: input.status,
    // Round-trip through the normaliser so only well-formed rules are stored.
    spec: normalizeBlueprintSpec(input.spec),
    updated_by: userId,
  }
}

export async function createMockBlueprint(input: MockBlueprintInput, userId: string): Promise<string> {
  if (!input.title.trim()) {
    throw new Error('Enter a blueprint title.')
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mock_blueprints')
    .insert({ ...toPayload(input, userId), created_by: userId })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error('Unable to create the blueprint.')
  }
  return data.id
}

export async function updateMockBlueprint(id: string, input: MockBlueprintInput, userId: string): Promise<void> {
  if (!input.title.trim()) {
    throw new Error('Enter a blueprint title.')
  }
  const supabase = await createClient()
  const { error } = await supabase.from('mock_blueprints').update(toPayload(input, userId)).eq('id', id)
  if (error) {
    throw new Error('Unable to update the blueprint.')
  }
}

export async function setBlueprintStatus(id: string, status: BlueprintStatus, userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('mock_blueprints')
    .update({ status, updated_by: userId })
    .eq('id', id)
  if (error) {
    throw new Error('Unable to change the blueprint status.')
  }
}

export async function deleteMockBlueprint(id: string): Promise<void> {
  const supabase = await createClient()
  // Mock_tests.blueprint_id is ON DELETE SET NULL, so existing mocks are unharmed.
  const { error } = await supabase.from('mock_blueprints').delete().eq('id', id)
  if (error) {
    throw new Error('Unable to delete the blueprint.')
  }
}
