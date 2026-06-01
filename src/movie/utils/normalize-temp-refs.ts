export function normalizeTempRefs(files?: string[]) {
    if (!files?.length) return [];
    return files
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
}

