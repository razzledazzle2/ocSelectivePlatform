export function parseCsvText(input: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ''
  let inQuotes = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const nextChar = input[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }

      continue
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentValue)
      currentValue = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1
      }

      currentRow.push(currentValue)
      currentValue = ''

      if (currentRow.some((value) => value.trim() !== '')) {
        rows.push(currentRow)
      }

      currentRow = []
      continue
    }

    currentValue += char
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue)

    if (currentRow.some((value) => value.trim() !== '')) {
      rows.push(currentRow)
    }
  }

  return rows
}
