let syncInProgress = false
let syncPromise: Promise<void> | null = null

export async function ensureBenefitsSynced() {
  // Prevent concurrent syncs
  if (syncInProgress) {
    return syncPromise
  }

  // Check if already synced
  const hasTemplates = await checkTemplatesExist()
  if (hasTemplates) {
    return
  }

  // Start sync in background
  syncInProgress = true
  syncPromise = performSync()

  try {
    await syncPromise
  } finally {
    syncInProgress = false
  }
}

async function checkTemplatesExist(): Promise<boolean> {
  try {
    const response = await fetch('/api/check-templates', {
      method: 'GET',
      next: { revalidate: 0 }
    })
    const data = await response.json()
    return data.hasTemplates ?? false
  } catch {
    return false
  }
}

async function performSync(): Promise<void> {
  try {
    await fetch('/api/sync-benefits', {
      method: 'POST',
      next: { revalidate: 0 }
    })
  } catch (error) {
    console.error('Background sync failed:', error)
  }
}
