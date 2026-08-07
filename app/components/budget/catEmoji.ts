export function getCatEmoji(catName: string, icon?: string | null): string {
  return icon || CAT_EMOJI[catName.toLowerCase()] || '•'
}

export const CAT_EMOJI: Record<string, string> = {
  'restaurants': '🍽️', 'dining': '🍽️', 'food & drink': '🍽️', 'food and drink': '🍽️',
  'groceries': '🛒', 'supermarkets': '🛒',
  'shopping': '🛍️', 'clothing': '👗', 'amazon': '📦', 'online shopping': '🛍️',
  'entertainment': '🎬', 'movies': '🎬', 'music': '🎵', 'games': '🎮',
  'transit': '🚇', 'transportation': '🚗', 'uber': '🚗', 'lyft': '🚗', 'parking': '🅿️', 'parking & tolls': '🅿️',
  'transit & rideshare': '🚗',
  'travel': '✈️', 'flights': '✈️', 'hotels': '🏨', 'airbnb': '🏠', 'trip': '✈️',
  'health': '💊', 'healthcare': '💊', 'pharmacy': '💊', 'medical': '🏥', 'fitness': '💪',
  'utilities': '💡', 'electric': '💡', 'gas': '⛽', 'water': '💧', 'internet': '📶',
  'rent': '🏠', 'housing': '🏠', 'mortgage': '🏠',
  'subscriptions': '📱', 'software': '💻', 'streaming': '📺',
  'personal care': '💅', 'beauty': '💄',
  'education': '📚', 'books': '📖',
  'gifts': '🎁', 'donations': '❤️', 'charity': '❤️',
  'pets': '🐾',
  'insurance': '🛡️', 'home insurance': '🛡️',
  'savings': '💰', 'investments': '📈',
  'income': '💵', 'paycheck': '💵', 'salary': '💵',
  'fees': '💸', 'bank fees': '💸', 'interest': '💸',
  'credit card annual fees': '💸',
  'transfer': '↔️', 'credit card payment': '💳',
  'balance adjustments': '⚖️',
}
