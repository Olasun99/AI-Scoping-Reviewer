import { Article } from "../types";

export async function searchOpenAlex(query: string, limit: number = 100) {
  // OpenAlex works better with simple term searches rather than complex boolean strings out of the box,
  // but we can pass the query to the 'default.search' or 'title_and_abstract.search'
  const encQuery = encodeURIComponent(query);
  const searchUrl = `https://api.openalex.org/works?search=${encQuery}&per-page=${Math.min(limit, 200)}&mailto=olawalesunmonu91@gmail.com`;
  
  const res = await fetch(searchUrl);
  if (!res.ok) throw new Error("Network error fetching from OpenAlex");
  
  const data = await res.json();
  const count = data.meta?.count || 0;
  
  const results: Article[] = (data.results || []).map((work: any) => {
    // OpenAlex provides abstract as inverted index, need to reconstruct
    let abstract = "";
    if (work.abstract_inverted_index) {
      const idx = work.abstract_inverted_index;
      const wordArr: string[] = [];
      Object.entries(idx).forEach(([word, positions]: [string, any]) => {
        positions.forEach((pos: number) => {
          wordArr[pos] = word;
        });
      });
      abstract = wordArr.join(" ").trim();
    }
    
    return {
      id: work.id.replace('https://openalex.org/', ''), // use OpenAlex ID
      title: work.title || 'Untitled',
      abstract: abstract || 'No abstract available.',
      authors: (work.authorships || []).map((a: any) => a.author?.display_name).join("; "),
      year: work.publication_year ? work.publication_year.toString() : 'Unknown',
      journal: work.primary_location?.source?.display_name || 'Unknown Journal',
      url: work.id,
      doi: work.doi || '',
      decision: 'pending',
      fullTextDecision: 'pending'
    };
  });
  
  return { results, count };
}
