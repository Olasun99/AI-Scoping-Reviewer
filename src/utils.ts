export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const d: number[][] = [];
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  for (let i = 0; i <= m; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    d[0][j] = j;
  }
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return d[m][n];
}

export function areTitlesSimilar(t1: string, t2: string, threshold: number = 0.85): boolean {
  if (!t1 || !t2) return false;
  const clean1 = t1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const clean2 = t2.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!clean1 || !clean2) return false;
  if (clean1 === clean2) return true;
  
  const distance = levenshteinDistance(clean1, clean2);
  const maxLength = Math.max(clean1.length, clean2.length);
  const similarity = (maxLength - distance) / maxLength;
  
  return similarity >= threshold;
}
