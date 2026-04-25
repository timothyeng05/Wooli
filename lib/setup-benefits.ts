import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'

export async function ensureBenefitsFile() {
  const publicDataPath = path.join(process.cwd(), 'public', 'data')
  const excelPath = path.join(publicDataPath, 'benefits.xlsx')

  // If benefits.xlsx already exists, we're good
  if (fs.existsSync(excelPath)) {
    return excelPath
  }

  // Try to find CSV in common locations
  const csvLocations = [
    path.join(process.cwd(), 'public', 'data', 'card_benefits.csv'),
    path.join(process.cwd(), 'card_benefits.csv'),
    path.join(require('os').homedir(), 'Downloads', 'card_benefits_1.csv'),
    path.join(require('os').homedir(), 'Downloads', 'card_benefits.csv'),
  ]

  let csvPath: string | null = null
  for (const loc of csvLocations) {
    if (fs.existsSync(loc)) {
      csvPath = loc
      break
    }
  }

  if (!csvPath) {
    console.warn('No CSV found in common locations. Skipping benefits file creation.')
    return null
  }

  // Create directory if it doesn't exist
  if (!fs.existsSync(publicDataPath)) {
    fs.mkdirSync(publicDataPath, { recursive: true })
  }

  // Read CSV and convert to Excel
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const lines = csvContent.split('\n')

  // Parse CSV manually to handle quoted fields
  const data: string[][] = []
  let currentRow: string[] = []
  let inQuotes = false
  let currentField = ''

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentField.trim())
        currentField = ''
      } else {
        currentField += char
      }
    }

    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim())
      if (currentRow.some(f => f.length > 0)) {
        data.push(currentRow)
      }
      currentRow = []
      currentField = ''
    }
  }

  // Create workbook and write to Excel
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(data)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Benefits')
  XLSX.writeFile(workbook, excelPath)

  console.log(`Created benefits.xlsx from CSV at ${excelPath}`)
  return excelPath
}
