/**
 * Generate a unique ID for database records
 * Format: {prefix}-{timestamp}-{random}
 * Example: article-1735678901234-a7x9k2
 */
export function generateId(prefix: string = 'record'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8); // 6 random chars
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Generate a UUID v4 (alternative option)
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
