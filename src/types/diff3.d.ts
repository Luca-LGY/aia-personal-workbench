declare module 'diff3' { const merge: <T>(a: T[], original: T[], b: T[]) => ({ ok: T[] } | { conflict: unknown })[]; export default merge }
