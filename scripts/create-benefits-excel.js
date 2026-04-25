const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const csvPath = path.join(process.env.HOME || process.env.USERPROFILE, 'Downloads', 'card_benefits_1.csv');
const content = fs.readFileSync(csvPath, 'utf-8');

const lines = content.split('\n');
const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

// Essential headers for sync
const newHeaders = [
  'Card',
  'Benefit Name',
  'Category',
  'Amount',
  'Amount Unit',
  'Period Type',
  'Period Frequency',
  'Core/Ancillary',
  'Description'
];
const data = [newHeaders];

function parseAmount(amountStr) {
  if (!amountStr) return { amount: null, unit: null };
  const trimmed = amountStr.trim();

  // Extract prefix symbol (e.g., $)
  const prefixMatch = trimmed.match(/^[^\d]+/);
  const prefix = prefixMatch ? prefixMatch[0] : '';

  // Extract number
  const numberMatch = trimmed.match(/[\d,]+/);
  if (numberMatch) {
    const num = parseInt(numberMatch[0].replace(/,/g, ''), 10);
    const restStart = numberMatch.index + numberMatch[0].length;
    const suffix = trimmed.substring(restStart).trim();

    // Combine prefix and suffix as unit
    const unit = (prefix + suffix).trim() || null;
    return { amount: num, unit };
  }

  return { amount: null, unit: trimmed };
}

function parseCadence(cadenceStr) {
  if (!cadenceStr) return { periodType: null, periodFrequency: null };
  const lower = cadenceStr.toLowerCase().trim();
  if (lower.includes('quarter')) return { periodType: 'quarterly', periodFrequency: 4 };
  if (lower.includes('month')) return { periodType: 'monthly', periodFrequency: 12 };
  if (lower.includes('annual') || lower.includes('year')) return { periodType: 'annual', periodFrequency: 1 };
  return { periodType: lower, periodFrequency: 1 };
}

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;

  const values = [];
  let current = '';
  let inQuotes = false;

  for (let j = 0; j < lines[i].length; j++) {
    const char = lines[i][j];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim().replace(/^"|"$/g, ''));

  if (values.some(v => v.length > 0)) {
    const card = values[rawHeaders.indexOf('Card')] || '';
    const benefitName = values[rawHeaders.indexOf('Benefit Name')] || '';
    const category = values[rawHeaders.indexOf('Category')] || '';
    const amountStr = values[rawHeaders.indexOf('Amount / Value')] || '';
    const cadenceStr = values[rawHeaders.indexOf('Cadence')] || '';
    const description = values[rawHeaders.indexOf('Notes')] || '';

    const { amount, unit } = parseAmount(amountStr);
    const { periodType, periodFrequency } = parseCadence(cadenceStr);

    data.push([
      card,
      benefitName,
      category,
      amount?.toString() || '',
      unit || '',
      periodType || '',
      periodFrequency?.toString() || '',
      'Core',
      description
    ]);
  }
}

const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.aoa_to_sheet(data);
XLSX.utils.book_append_sheet(workbook, worksheet, 'Benefits');

const outDir = path.join(process.cwd(), 'public', 'data');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outPath = path.join(outDir, 'benefits.xlsx');
XLSX.writeFile(workbook, outPath);

console.log(`✅ Created ${outPath}`);
console.log(`Headers: ${newHeaders.join(', ')}`);
console.log(`Rows: ${data.length - 1}`);
