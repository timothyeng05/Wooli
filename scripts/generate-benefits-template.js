const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Create workbook
const workbook = XLSX.utils.book_new();

// Sheet 1: Benefits Template
const benefitsData = [
  // Header row
  ['Card', 'Benefit Name', 'Category', 'Amount', 'Amount Unit', 'Period Type', 'Period Frequency', 'Core/Ancillary', 'Enrollment Required', 'Enrollment Notes', 'Description', 'Benefit Notes', 'Hard Expiration Date'],

  // CHASE SAPPHIRE RESERVE - DINING
  ['Chase Sapphire Reserve', 'Dining Credit - Exclusive Tables', 'Dining', 300, 'dollars', 'semi_annual', 6, 'Core', 'No', '', 'Up to $150 statement credits Jan-Jun and Jul-Dec', 'Dine at Sapphire Reserve Exclusive Tables via OpenTable or partnered restaurants', ''],

  // CHASE SAPPHIRE RESERVE - TRAVEL
  ['Chase Sapphire Reserve', 'Travel Credit', 'Travel', 300, 'dollars', 'annual', 12, 'Core', 'No', '', 'Up to $300 in automatic statement credits annually', 'Applies to any eligible travel purchase: flights, hotels, Airbnb, Uber, tolls, parking', ''],
  ['Chase Sapphire Reserve', 'Edit Hotels Credit', 'Travel', 500, 'dollars', 'annual', 12, 'Ancillary', 'No', '', 'Up to $250 per transaction, max $500 annually', 'Prepaid stays at The Edit by Chase Travel with 2-night minimum', ''],
  ['Chase Sapphire Reserve', 'Select Hotels Credit', 'Travel', 250, 'dollars', 'one_time', '', 'Ancillary', 'No', '', 'One-time $250 on prepaid Chase Travel bookings', 'Applies through December 31, 2026 at partner hotels (IHG, Montage, Omni, etc)', '2026-12-31'],
  ['Chase Sapphire Reserve', 'Global Entry / TSA PreCheck Credit', 'Travel', 120, 'dollars', 'every_4_years', '', 'Core', 'No', '', 'Every 4 years', 'Covers full Global Entry ($120) or TSA PreCheck ($85)', ''],
  ['Chase Sapphire Reserve', 'StubHub / Viagogo Credit', 'Travel', 300, 'dollars', 'semi_annual', 6, 'Ancillary', 'No', '', 'Up to $150 Jan-Jun and Jul-Dec', 'Valid through December 31, 2027', '2027-12-31'],

  // CHASE SAPPHIRE RESERVE - ENTERTAINMENT
  ['Chase Sapphire Reserve', 'Lyft Credit', 'Entertainment', 120, 'dollars', 'monthly', 1, 'Core', 'Yes', 'Link card to Lyft app', 'Up to $10/month on Lyft rides', 'Also earn 5x points on additional rides. Valid through September 30, 2027', '2027-09-30'],
  ['Chase Sapphire Reserve', 'DoorDash & DashPass', 'Entertainment', 420, 'dollars', 'annual', 12, 'Core', 'Yes', 'Enroll via Chase app', 'Up to $300 in promos + $120 DashPass membership annually', 'DashPass covers $0 delivery on eligible orders', ''],
  ['Chase Sapphire Reserve', 'Peloton Membership Credit', 'Entertainment', 120, 'dollars', 'annual', 12, 'Ancillary', 'No', '', 'Annual statement credits toward Peloton', 'Valid through December 31, 2027. Also earn 10x points on equipment purchases over $150', '2027-12-31'],
  ['Chase Sapphire Reserve', 'Apple TV+ & Apple Music', 'Entertainment', 288, 'dollars', 'annual', 12, 'Ancillary', 'Yes', 'Activation required', 'Complimentary subscriptions', 'Valid through June 22, 2027', '2027-06-22'],

  // CHASE SAPPHIRE RESERVE - LOUNGE
  ['Chase Sapphire Reserve', 'Chase Sapphire Lounges & Priority Pass', 'Lounge Access', '', 'access', 'annual', 12, 'Ancillary', 'No', '', 'Unlimited lounge access', 'Chase Sapphire Lounges with up to 2 guests. Priority Pass Select: 1300+ lounges worldwide', ''],

  // CHASE SAPPHIRE RESERVE - STATUS
  ['Chase Sapphire Reserve', 'Hotel & Car Rental Elite Status', 'Hotel/Car Status', '', 'access', 'annual', 12, 'Ancillary', 'No', '', 'Auto-enrolled elite status', 'Hertz Five Star, Avis Preferred Plus, National Emerald Club Executive', ''],

  // CHASE SAPPHIRE RESERVE - INSURANCE
  ['Chase Sapphire Reserve', 'Trip Cancellation & Interruption Insurance', 'Insurance', 10000, 'dollars', 'per_trip', '', 'Ancillary', 'No', '', 'Up to $10k/person, $20k/trip', 'Covers pre-paid non-refundable expenses if trip canceled/interrupted', ''],
  ['Chase Sapphire Reserve', 'Trip Delay Reimbursement', 'Insurance', 500, 'dollars', 'per_trip', '', 'Ancillary', 'No', '', 'Kicks in after 6-hour delay', 'Covers meals, lodging, incidentals', ''],
  ['Chase Sapphire Reserve', 'Auto Rental CDW (Primary)', 'Insurance', 75000, 'dollars', 'per_trip', '', 'Ancillary', 'No', '', 'PRIMARY coverage for theft/collision', 'Decline rental company CDW. Covers up to 31-day rentals', ''],

  // CHASE SAPPHIRE RESERVE - POINTS
  ['Chase Sapphire Reserve', 'Points Transfer Partners', 'Points & Rewards', '', 'points', 'per_transaction', '', 'Ancillary', 'No', '', '1:1 transfer ratio', 'Transfer partners: Aer Lingus, Air Canada, British Airways, United, Southwest, World of Hyatt, IHG, Marriott, and more', ''],

  // CHASE SAPPHIRE RESERVE - OTHER
  ['Chase Sapphire Reserve', 'Visa Infinite Concierge', 'Other', '', 'access', 'annual', 12, 'Ancillary', 'No', '', '24/7 complimentary concierge', 'Reservations, event tickets, gift sourcing, travel assistance', ''],
  ['Chase Sapphire Reserve', 'No Foreign Transaction Fees', 'Other', 0, 'dollars', 'annual', 12, 'Ancillary', 'No', '', 'Zero fees', 'No surcharge on purchases made outside the US', ''],

  // AMEX PLATINUM - DINING
  ['American Express Platinum', 'Resy Dining Credit', 'Dining', 400, 'dollars', 'quarterly', 3, 'Core', 'Yes', 'Enroll via Amex app', 'Up to $100/quarter at participating US Resy restaurants', '10,000+ eligible restaurants', ''],
  ['American Express Platinum', 'Uber Cash', 'Dining', 200, 'dollars', 'monthly', 1, 'Core', 'Yes', 'Link card to Uber app', '$15/month for US Uber rides or Eats + $20 bonus in December', 'Must select Amex card in Uber app', ''],

  // AMEX PLATINUM - TRAVEL
  ['American Express Platinum', 'Fine Hotels + Resorts / Hotel Collection Credit', 'Travel', 600, 'dollars', 'semi_annual', 6, 'Core', 'No', '', 'Up to $300 semiannually on prepaid bookings', 'Includes breakfast for 2, $100 property credit, 4PM late checkout, room upgrade', ''],
  ['American Express Platinum', 'Airline Incidental Fee Credit', 'Travel', 200, 'dollars', 'annual', 12, 'Core', 'Yes', 'Enroll for 1 qualifying airline', 'Covers checked bags, seat upgrades, in-flight food/drinks, lounge day passes', 'Does NOT cover airfare itself', ''],
  ['American Express Platinum', 'Uber One Membership Credit', 'Travel', 120, 'dollars', 'annual', 12, 'Ancillary', 'Yes', 'Auto-renewing membership required', 'Statement credits toward Uber One membership purchase', '', ''],
  ['American Express Platinum', 'Global Entry / TSA PreCheck / NEXUS Credit', 'Travel', 120, 'dollars', 'every_4_years', '', 'Ancillary', 'No', '', 'Every 4 years', 'Covers application fee for Global Entry ($120), TSA PreCheck ($85), or NEXUS ($50)', ''],

  // AMEX PLATINUM - ENTERTAINMENT
  ['American Express Platinum', 'Digital Entertainment Credit', 'Entertainment', 300, 'dollars', 'monthly', 1, 'Core', 'Yes', 'Purchase directly from providers', '$25/month for Disney+, ESPN+, Hulu, Paramount+, Peacock, YouTube Premium, NYT, WSJ', 'Must purchase directly from provider', ''],
  ['American Express Platinum', 'Equinox+ & Gym Credit', 'Entertainment', 300, 'dollars', 'monthly', 1, 'Core', 'Yes', 'Add card to Equinox account', '$25/month toward Equinox+ digital or club membership dues', 'Does not cover initiation fees', ''],
  ['American Express Platinum', 'Lululemon Credit', 'Entertainment', 300, 'dollars', 'quarterly', 3, 'Core', 'Yes', 'Automatic with card', '$75/quarter at US lululemon retail or lululemon.com', 'No minimum purchase required', ''],
  ['American Express Platinum', 'Walmart+ Credit', 'Entertainment', 155, 'dollars', 'monthly', 1, 'Core', 'Yes', 'Auto-renew required', 'Covers monthly Walmart+ fee', 'Includes free shipping, Paramount+, gas discounts', ''],
  ['American Express Platinum', 'CLEAR+ Membership Credit', 'Entertainment', 209, 'dollars', 'annual', 12, 'Core', 'Yes', 'Enroll via Amex app', 'Covers full CLEAR+ membership cost', 'Biometric expedited security at 50+ airports and venues', ''],
  ['American Express Platinum', 'Oura Ring Credit', 'Entertainment', 200, 'dollars', 'annual', 12, 'Ancillary', 'Yes', 'Enroll via Amex app', 'One-time credit toward Oura Ring purchase', 'Valid through OURAring.com', ''],
  ['American Express Platinum', 'Saks Fifth Avenue Credit (ENDING)', 'Entertainment', 50, 'dollars', 'semi_annual', 6, 'Ancillary', 'Yes', 'Auto-applied Jan-Jun only', 'ENDING June 30, 2026. $50 credit Jan-Jun only', 'No Saks credit from July 2026 onward', '2026-06-30'],

  // AMEX PLATINUM - LOUNGE
  ['American Express Platinum', 'Centurion Lounge Access', 'Lounge Access', '', 'access', 'annual', 12, 'Ancillary', 'No', '', 'Unlimited lounge access', 'Exclusive Centurion Lounges (no complimentary guests unless $75k/year spend)', ''],
  ['American Express Platinum', 'Priority Pass Select', 'Lounge Access', '', 'access', 'annual', 12, 'Ancillary', 'Yes', 'Enroll via Amex', '1300+ airport lounges globally', 'Does NOT include Amex Centurion or Delta Sky Club', ''],
  ['American Express Platinum', 'Delta Sky Club Access', 'Lounge Access', '', 'access', 'annual', 12, 'Ancillary', 'No', '', '10 visits/year', 'When flying on eligible Delta flight above Basic Economy', ''],

  // AMEX PLATINUM - STATUS
  ['American Express Platinum', 'Hilton Honors Gold Elite Status', 'Hotel/Car Status', '', 'access', 'annual', 12, 'Ancillary', 'Yes', 'Enroll via Amex', 'Gold Elite status', '25% bonus points, complimentary breakfast or F&B credit, room upgrades', ''],
  ['American Express Platinum', 'Marriott Bonvoy Gold Elite Status', 'Hotel/Car Status', '', 'access', 'annual', 12, 'Ancillary', 'Yes', 'Enroll via Amex', 'Gold Elite status', 'Enhanced room, 2PM late checkout, 25% bonus points, welcome gift', ''],

  // AMEX PLATINUM - INSURANCE
  ['American Express Platinum', 'Trip Cancellation & Interruption Insurance', 'Insurance', 10000, 'dollars', 'per_trip', '', 'Ancillary', 'No', '', 'Up to $10k/trip', 'Non-refundable travel expenses if trip canceled/interrupted', ''],
  ['American Express Platinum', 'Baggage Insurance', 'Insurance', 3000, 'dollars', 'per_trip', '', 'Ancillary', 'No', '', 'Up to $3k carry-on, $2k checked', 'Covers lost/damaged/stolen baggage on common carrier', ''],
  ['American Express Platinum', 'Cell Phone Protection', 'Insurance', 800, 'dollars', 'annual', 12, 'Ancillary', 'Yes', 'Pay cell bill with Platinum card', 'Up to $800/claim, 2 claims/year, $50 deductible', 'Covers theft or accidental damage', ''],

  // AMEX PLATINUM - POINTS
  ['American Express Platinum', '5X Points on Flights & Prepaid Hotels', 'Points & Rewards', '', 'points', 'per_transaction', '', 'Ancillary', 'No', '', '5x MR points', 'On flights and prepaid hotels through Amex Travel or directly with airlines/hotels', ''],
  ['American Express Platinum', '1X Points Base Rate', 'Points & Rewards', '', 'points', 'per_transaction', '', 'Ancillary', 'No', '', '1x MR points', 'On all other purchases', ''],

  // AMEX PLATINUM - OTHER
  ['American Express Platinum', 'Amex Concierge', 'Other', '', 'access', 'annual', 12, 'Ancillary', 'No', '', '24/7 personal concierge', 'Restaurant reservations, event tickets, travel bookings, gift sourcing', ''],
  ['American Express Platinum', 'Global Assist Hotline', 'Other', '', 'access', 'annual', 12, 'Ancillary', 'No', '', '24/7 travel emergency assistance', 'Medical/legal referrals, emergency cash, lost passport assistance (100+ miles from home)', ''],
  ['American Express Platinum', 'No Foreign Transaction Fees', 'Other', 0, 'dollars', 'annual', 12, 'Ancillary', 'No', '', 'Zero fees', 'No foreign transaction fees on international purchases', ''],
];

const worksheet = XLSX.utils.aoa_to_sheet(benefitsData);

// Set column widths
worksheet['!cols'] = [
  { wch: 25 }, // Card
  { wch: 35 }, // Benefit Name
  { wch: 18 }, // Category
  { wch: 10 }, // Amount
  { wch: 12 }, // Amount Unit
  { wch: 15 }, // Period Type
  { wch: 10 }, // Period Frequency
  { wch: 15 }, // Core/Ancillary
  { wch: 18 }, // Enrollment Required
  { wch: 20 }, // Enrollment Notes
  { wch: 40 }, // Description
  { wch: 50 }, // Benefit Notes
  { wch: 18 }, // Hard Expiration Date
];

// Add worksheet to workbook
XLSX.utils.book_append_sheet(workbook, worksheet, 'Benefits');

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, '..', 'public', 'data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write file
const outputPath = path.join(outputDir, 'benefits.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log(`✅ Benefits template created at: ${outputPath}`);
