// Deprecated GCS helper; migrated to Supabase storage. Keeping file to avoid import errors.
export async function uploadBufferToGCS(): Promise<string> {
  throw new Error('GCS is disabled. Use Supabase storage instead.');
}


