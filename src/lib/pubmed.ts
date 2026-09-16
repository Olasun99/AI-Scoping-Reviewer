import { Article } from "../types"

// Fetch from PubMed utilizing E-Utilities
export async function searchPubMed(query: string, limit: number = 100) {
  const encQuery = encodeURIComponent(query);
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encQuery}&retmax=${limit}&retmode=json`;
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) throw new Error("Network error fetching from PubMed");
  
  const searchData = await searchRes.json();
  const ids = searchData?.esearchresult?.idlist || [];
  return { ids, count: Number(searchData?.esearchresult?.count) || 0 };
}

export async function fetchPubMedDetails(ids: string[]): Promise<Article[]> {
  if (!ids || ids.length === 0) return [];
  
  const results: Article[] = [];
  // Chunking to prevent URI too long or timeouts
  const chunkSize = 200;
  
  for (let c = 0; c < ids.length; c += chunkSize) {
    const chunkIds = ids.slice(c, c + chunkSize);
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${chunkIds.join(',')}&retmode=xml`;
    const fetchRes = await fetch(fetchUrl);
    if (!fetchRes.ok) throw new Error("Network error fetching PubMed details");
    
    const xmlText = await fetchRes.text();
    
    // parse xml
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const articles = xmlDoc.getElementsByTagName("PubmedArticle");
    
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const pmid = article.getElementsByTagName("PMID")[0]?.textContent || '';
      const title = article.getElementsByTagName("ArticleTitle")[0]?.textContent || '';
      
      // Abstract
      const abstractTexts = article.getElementsByTagName("AbstractText");
      let abstract = "";
      for(let j=0; j<abstractTexts.length; j++) {
         abstract += (abstractTexts[j].textContent || "") + " ";
      }
      
      // Authors
      const authorList = article.getElementsByTagName("Author");
      let authors = [];
      for(let j=0; j<authorList.length; j++) {
         const lastName = authorList[j].getElementsByTagName("LastName")[0]?.textContent || '';
         const foreName = authorList[j].getElementsByTagName("ForeName")[0]?.textContent || '';
         if (lastName || foreName) authors.push(`${foreName} ${lastName}`.trim());
      }
      
      // Year
      let year = article.getElementsByTagName("Year")[0]?.textContent || '';
      if (!year) {
        // Fallback
        const medlineDate = article.getElementsByTagName("MedlineDate")[0]?.textContent || '';
        if (medlineDate) {
          year = medlineDate.substring(0,4);
        }
      }
      
      const journal = article.getElementsByTagName("Title")[0]?.textContent || '';

      // Extract DOI
      let doi = '';
      const articleIds = article.getElementsByTagName("ArticleId");
      for (let j = 0; j < articleIds.length; j++) {
        if (articleIds[j].getAttribute("IdType") === "doi") {
          doi = articleIds[j].textContent || '';
          break;
        }
      }

      results.push({
        id: pmid,
        title,
        abstract: abstract.trim(),
        authors: authors.join("; "),
        year,
        journal,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        doi,
        decision: 'pending',
        fullTextDecision: 'pending'
      });
    }
    
    // Add small delay to respect rate limits if there are more chunks
    if (c + chunkSize < ids.length) {
       await new Promise(r => setTimeout(r, 340)); // Max 3 requests per second
    }
  }
  
  return results;
}
