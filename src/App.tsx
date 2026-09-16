import React, { useState, useEffect } from 'react';
import { AppState, Article, ProjectConfig, SearchStrategy, RecentSearch, MetaAnalysisData, GradeAssessment } from './types';
import { searchPubMed, fetchPubMedDetails } from './lib/pubmed';
import { searchOpenAlex } from './lib/openalex';
import { PRISMADiagram } from './components/PRISMADiagram';
import { ExtractionModal } from './components/ExtractionModal';
import { areTitlesSimilar } from './utils';
import { Search, ListChecks, Database, FileSpreadsheet, Download, Activity, Play, CheckCircle, XCircle, Loader2, Code, BookMarked, HelpCircle, ChevronRight, Sparkles } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const HELP_GUIDE = [
  {
    step: 1,
    title: "Protocol & Setup",
    actions: [
      { type: 'input', label: 'Project Configuration', desc: 'Enter a Project Title, Reviewer Name, and Framework (PICO or PCC).' },
      { type: 'button', label: 'Load Template', desc: 'Use this dropdown to instantly auto-fill fields for common study types (e.g. Prevalence, Clinical RCT).' },
      { type: 'input', label: 'Inclusion/Exclusion', desc: 'Clearly define your criteria to guide the AI during the screening process.' }
    ],
    outcome: 'A fully defined research protocol.'
  },
  {
    step: 2,
    title: "Retrieval",
    actions: [
      { type: 'input', label: 'Boolean Query', desc: 'Write a boolean string (e.g., "(Term A OR Term B) AND Term C").' },
      { type: 'button', label: 'Build Query', desc: 'Generate a query automatically based on your PICO/PCC framework.' },
      { type: 'button', label: 'Select Databases & Search', desc: 'Choose PubMed, OpenAlex, etc. and click Execute Search to fetch records.' }
    ],
    outcome: 'A list of raw records (titles/abstracts) imported into the tool.'
  },
  {
    step: 3,
    title: "Title/Abstract Screening",
    actions: [
      { type: 'button', label: 'AI Auto-Screen', desc: 'Let the AI automatically exclude irrelevant records based on your strict inclusion/exclusion criteria.' },
      { type: 'button', label: 'Include / Exclude', desc: 'Manually screen titles and abstracts. Use bulk or individual view mode.' }
    ],
    outcome: 'A filtered list of relevant abstracts advancing to full-text review.'
  },
  {
    step: 4,
    title: "Full-Text Screening",
    actions: [
      { type: 'button', label: 'Include / Exclude', desc: 'Review the full text or detailed abstract for final inclusion.' },
      { type: 'input', label: 'Reason for Exclusion', desc: '(Optional) Add a reason for PRISMA reporting.' }
    ],
    outcome: 'The final set of included articles ready for data extraction.'
  },
  {
    step: 5,
    title: "Quality Assessment",
    actions: [
      { type: 'input', label: 'Risk of Bias Scores', desc: 'Select Low, High, or Some Concerns for each study.' }
    ],
    outcome: 'Evaluated study quality to inform evidence synthesis.'
  },
  {
    step: 6,
    title: "Data Extraction",
    actions: [
      { type: 'input', label: 'Custom Fields', desc: 'Configure standard fields (e.g. Sample Size, Key Findings) to extract across all studies.' },
      { type: 'button', label: 'Advanced Extraction', desc: 'Open the detailed modal to use AI for auto-extracting data points per article.' }
    ],
    outcome: 'Structured tabular data synthesized from all included studies.'
  },
  {
    step: 7,
    title: "Synthesis & PRISMA",
    actions: [
      { type: 'button', label: 'Edit PRISMA', desc: 'Manually override PRISMA counts if you imported records externally.' },
      { type: 'button', label: 'Preview Export', desc: 'Verify your data formatting in a read-only table.' },
      { type: 'button', label: 'Export (CSV, JSON, PDF)', desc: 'Download your evidence maps and final narrative synthesis.' }
    ],
    outcome: 'Final exported synthesis reports and flowcharts.'
  }
];

const INITIAL_CONFIG: ProjectConfig = {
  title: "",
  reviewType: "Scoping Review",
  population: "",
  interventions: "",
  outcomes: "",
  startYear: "2020",
  endYear: "2026",
  frameworkType: 'PICO',
  pico: { p: '', i: '', c: '', o: '' },
  pcc: { p: '', c: '', c2: '' },
  inclusionCriteria: '',
  exclusionCriteria: '',
  extractionFields: ['Study Design', 'Sample Size', 'Key Findings']
};

const STEPS = [
  { id: 1, name: 'Protocol & Setup', icon: Activity },
  { id: 2, name: 'Retrieval', icon: Database },
  { id: 3, name: 'Title/Abstract Screening', icon: ListChecks },
  { id: 4, name: 'Full-Text Screening', icon: FileSpreadsheet },
  { id: 5, name: 'Quality Assessment', icon: ListChecks },
  { id: 6, name: 'Data Extraction', icon: FileSpreadsheet },
  { id: 7, name: 'Synthesis & PRISMA', icon: Download },
];

function generateNarrativeSynthesis(articles: Article[], reviewType: string) {
  const total = articles.length;
  if (total === 0) return "No articles met the inclusion criteria.";
  
  const designs = articles.reduce((acc, curr) => {
    const design = curr.qualityAssessment?.design || 'Not specified';
    acc[design] = (acc[design] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const designStr = Object.entries(designs).map(([k,v]) => `${v} ${k.toLowerCase()} ${v === 1 ? 'study' : 'studies'}`).join(', ');

  const lowRisk = articles.filter(a => a.qualityAssessment?.score === 'Low Risk').length;
  const highRisk = articles.filter(a => a.qualityAssessment?.score === 'High Risk').length;
  const unassessed = articles.filter(a => !a.qualityAssessment?.score || a.qualityAssessment?.score === 'Unassessed').length;

  return `A total of ${total} studies met the inclusion criteria and were included in this ${reviewType.toLowerCase()}. 

The included studies encompassed a variety of study designs: ${designStr}. 

Quality Assessment Summary:
Risk of bias assessments were conducted using appropriate tools based on the study designs. ${lowRisk} studies demonstrated low risk of bias, while ${highRisk} studies were assessed as high risk. ${unassessed > 0 ? `There were ${unassessed} studies that were not formally assessed.` : ''}

General Synthesis:
The data extracted from these studies reflect the defined PICO/PCC framework constraints. The literature varied in its approach and findings, necessitating a careful thematic analysis. Further manual categorization is recommended to group these findings into specific narrative themes based on the extracted variables. Please refer to the full data extraction table for study-specific outcomes and characteristics.`;
}

export default function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [isPrismaModalOpen, setIsPrismaModalOpen] = useState(false);
  const [isHelpSidebarOpen, setIsHelpSidebarOpen] = useState(false);
  const [isAutoFillingFramework, setIsAutoFillingFramework] = useState(false);

  const [state, setState] = useState<AppState>({
    config: INITIAL_CONFIG,
    strategy: {
      populationTerms: INITIAL_CONFIG.population,
      conceptTerms: INITIAL_CONFIG.outcomes,
      riskFactorTerms: INITIAL_CONFIG.interventions,
      builtQuery: ''
    },
    articles: [],
    isSearching: false,
    isAutoScreening: false,
    totalIdentified: 0,
    totalDuplicates: 0,
    searchProgress: '',
    prismaOverrides: {},
    gradeAssessments: [],
  });
  
  const handleAutoFillFramework = async () => {
    if (!state.config.title || !state.config.inclusionCriteria) return;
    setIsAutoFillingFramework(true);
    try {
      const response = await fetch('/api/auto-fill-framework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           title: state.config.title, 
           inclusionCriteria: state.config.inclusionCriteria,
           frameworkType: state.config.frameworkType
        })
      });
      if (!response.ok) throw new Error('Failed to auto-fill');
      const data = await response.json();
      
      if (state.config.frameworkType === 'PICO' && data.pico) {
         setState(prev => ({ ...prev, config: { ...prev.config, pico: data.pico }}));
      } else if (state.config.frameworkType === 'PCC' && data.pcc) {
         setState(prev => ({ ...prev, config: { ...prev.config, pcc: data.pcc }}));
      }
    } catch (error) {
      console.error(error);
      alert('Failed to auto-fill framework. Please try again later.');
    } finally {
      setIsAutoFillingFramework(false);
    }
  };
  
  useEffect(() => {
    const saved = localStorage.getItem('scoping_recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch(e){}
    }
    const savedConfig = localStorage.getItem('scoping_project_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setState(prev => ({ ...prev, config: { ...prev.config, ...parsed } }));
      } catch(e){}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('scoping_project_config', JSON.stringify(state.config));
  }, [state.config]);

  const saveSearch = (query: string) => {
    if (!query) return;
    const newSearch: RecentSearch = {
       id: Date.now().toString(),
       query,
       date: new Date().toLocaleDateString()
    };
    const updated = [newSearch, ...recentSearches.filter(s => s.query !== query)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('scoping_recent_searches', JSON.stringify(updated));
  }

  const updateConfig = (k: keyof ProjectConfig, v: any) => {
    setState(prev => ({ ...prev, config: { ...prev.config, [k]: v } }));
  };

  const addGradeAssessment = () => {
    setState(prev => ({
      ...prev,
      gradeAssessments: [
        ...prev.gradeAssessments,
        {
          id: Date.now().toString(),
          outcome: '',
          riskOfBias: '',
          inconsistency: '',
          indirectness: '',
          imprecision: '',
          publicationBias: '',
          certainty: '',
          importance: ''
        }
      ]
    }));
  };

  const updateGradeAssessment = (id: string, field: keyof GradeAssessment, value: string) => {
    setState(prev => ({
      ...prev,
      gradeAssessments: prev.gradeAssessments.map(g => g.id === id ? { ...g, [field]: value } : g)
    }));
  };

  const deleteGradeAssessment = (id: string) => {
    setState(prev => ({
      ...prev,
      gradeAssessments: prev.gradeAssessments.filter(g => g.id !== id)
    }));
  };

  const [selectedDatabases, setSelectedDatabases] = useState({ 
    pubmed: true, 
    pmc: false,
    europePmc: false,
    crossref: false,
    scopus: false,
    webOfScience: false,
    semanticScholar: false,
    openalex: true,
    doaj: false,
    googleScholar: false,
    clinicalTrials: false,
    whoIctrp: false,
    cochrane: false,
    biorxiv: false,
    medrxiv: false
  });
  const [maxResultsLimit, setMaxResultsLimit] = useState(200);
  const [extractionModalArticleId, setExtractionModalArticleId] = useState<string | null>(null);
  const [isExportPreviewOpen, setIsExportPreviewOpen] = useState(false);

  const handleExtractionSave = (articleId: string, updates: Partial<Article>) => {
    setState(prev => ({
      ...prev,
      articles: prev.articles.map(art => art.id === articleId ? { ...art, ...updates } : art)
    }));
  };

  const [screeningViewMode, setScreeningViewMode] = useState<'individual' | 'bulk'>('individual');
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set());
  const [bulkExclusionReason, setBulkExclusionReason] = useState<string>('Does not meet criteria');

  const handleBuildQuery = () => {
    const { strategy, config } = state;
    const { populationTerms, conceptTerms, riskFactorTerms } = strategy;
    const yearBlock = config.startYear && config.endYear ? `("${config.startYear}/01/01"[PDAT] : "${config.endYear}/12/31"[PDAT])` : '';
    
    const parts = [];
    if (populationTerms) parts.push(`(${populationTerms})`);
    if (conceptTerms) parts.push(`(${conceptTerms})`);
    if (riskFactorTerms) parts.push(`(${riskFactorTerms})`);
    if (yearBlock) parts.push(yearBlock);
    
    const query = parts.join(" AND ");
    setState(prev => ({ ...prev, strategy: { ...prev.strategy, builtQuery: query } }));
    return query;
  };

  const handleRetrieval = async () => {
    let q = state.strategy.builtQuery;
    if (!q) {
       q = handleBuildQuery();
    }
    setState(prev => ({ ...prev, isSearching: true, searchProgress: 'Querying selected databases...' }));
    
    try {
      saveSearch(q);
      
      let allArticles: Article[] = [];
      let totalCount = 0;
      
      if (selectedDatabases.pubmed) {
         setState(prev => ({ ...prev, searchProgress: 'Querying PubMed...' }));
         const { ids, count } = await searchPubMed(q, maxResultsLimit);
         totalCount += count;
         setState(prev => ({ ...prev, searchProgress: `PubMed found ${count} records. Fetching details...` }));
         const pubmedArticles = await fetchPubMedDetails(ids);
         allArticles = [...allArticles, ...pubmedArticles];
      }
      
      if (selectedDatabases.openalex) {
         setState(prev => ({ ...prev, searchProgress: 'Querying OpenAlex...' }));
         const oQuery = [state.strategy.populationTerms, state.strategy.conceptTerms, state.strategy.riskFactorTerms].filter(Boolean).join(" ");
         const { results, count } = await searchOpenAlex(oQuery, maxResultsLimit);
         totalCount += count;
         allArticles = [...allArticles, ...results];
      }
      
      setState(prev => ({ ...prev, searchProgress: `Deduplicating ${allArticles.length} combined records...` }));
      
      // Deduplicate records based on title similarity, DOI, or ID
      const uniqueArticles: Article[] = [];
      const seenIdentifiers = new Set<string>();
      const existingTitles: string[] = [];
      let duplicateCount = 0;

      allArticles.forEach(art => {
        const idKey = art.id;
        const doiKey = art.doi?.toLowerCase().trim();
        const titleKey = art.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        let isDuplicate = false;
        
        if (doiKey && seenIdentifiers.has(doiKey)) {
           isDuplicate = true;
        } else if (idKey && seenIdentifiers.has(idKey)) {
           isDuplicate = true;
        } else if (titleKey && titleKey.length > 10 && seenIdentifiers.has(titleKey)) {
           isDuplicate = true;
        } else {
           // Fuzzy matching
           for (const existing of existingTitles) {
              if (areTitlesSimilar(art.title, existing, 0.85)) {
                 isDuplicate = true;
                 break;
              }
           }
        }
        
        if (isDuplicate) {
           duplicateCount++;
        } else {
           if (doiKey) seenIdentifiers.add(doiKey);
           if (idKey) seenIdentifiers.add(idKey);
           if (titleKey && titleKey.length > 10) seenIdentifiers.add(titleKey);
           existingTitles.push(art.title);
           uniqueArticles.push(art);
        }
      });
      
      // Auto-Clean Pipeline
      const cleanedArticles = uniqueArticles
        .filter(art => art.title && art.title.length > 5 && art.authors) // Remove broken records
        .map(art => ({
          ...art,
          // Normalize author names
          authors: art.authors.replace(/\s+/g, ' ').trim(),
          // Normalize journal names
          journal: art.journal.replace(/\b[a-z]/g, char => char.toUpperCase()).trim(),
          // Standardize dates (year)
          year: art.year ? String(art.year).replace(/[^0-9]/g, '').substring(0, 4) : 'Unknown',
        }));

      setState(prev => ({ 
        ...prev, 
        articles: cleanedArticles,
        totalIdentified: totalCount,
        totalDuplicates: duplicateCount + (uniqueArticles.length - cleanedArticles.length), // Account for dropped broken records
        isSearching: false, 
        searchProgress: 'Complete.' 
      }));
      setCurrentStep(3); // move to screening
    } catch (err) {
      console.error(err);
      setState(prev => ({ ...prev, isSearching: false, searchProgress: 'Error fetching records. Please try again.' }));
    }
  };

  const handleScreeningDecision = (id: string, decision: 'included' | 'excluded', reason?: string) => {
    setState(prev => ({
      ...prev,
      articles: prev.articles.map(a => a.id === id ? { ...a, decision, exclusionReason: reason } : a)
    }));
  };

  const pendingArticles = state.articles.filter(a => a.decision === 'pending');
  const includedArticles = state.articles.filter(a => a.decision === 'included');
  const excludedArticles = state.articles.filter(a => a.decision === 'excluded');
  const fullyIncludedArticles = state.articles.filter(a => a.decision === 'included' && a.fullTextDecision === 'included');

  const handleAutoScreen = async () => {
    setState(prev => ({ ...prev, isAutoScreening: true }));
    let updatedArticles = [...state.articles];
    for (let i = 0; i < updatedArticles.length; i++) {
       const art = updatedArticles[i];
       if (art.decision === 'pending') {
          try {
             const res = await fetch('/api/screen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                   title: art.title,
                   abstract: art.abstract,
                   inclusionCriteria: state.config.inclusionCriteria,
                   exclusionCriteria: state.config.exclusionCriteria
                })
             });
             const data = await res.json();
             if (data && data.decision) {
                updatedArticles[i] = { 
                   ...art, 
                   decision: data.decision === 'included' ? 'included' : 'excluded',
                   exclusionReason: data.reason
                };
             }
          } catch (err) {
             console.error("Auto-screen error for", art.id, err);
          }
          // Update state incrementally
          setState(prev => ({ ...prev, articles: [...updatedArticles] }));
       }
    }
    setState(prev => ({ ...prev, isAutoScreening: false }));
  };

  const updateExtraction = (id: string, field: keyof Article, value: string) => {
     setState(prev => ({
        ...prev,
        articles: prev.articles.map(a => a.id === id ? { ...a, [field]: value } : a)
     }));
  };

  const updateCustomExtraction = (id: string, field: string, value: string) => {
     setState(prev => ({
        ...prev,
        articles: prev.articles.map(a => {
           if (a.id === id) {
              return { ...a, customExtraction: { ...(a.customExtraction || {}), [field]: value } };
           }
           return a;
        })
     }));
  };

  const updateMetaAnalysisData = (id: string, field: keyof MetaAnalysisData, value: string) => {
    setState(prev => ({
      ...prev,
      articles: prev.articles.map(a => 
        a.id === id ? { 
           ...a, 
           metaAnalysisData: { ...(a.metaAnalysisData || { effectSize: '', lowerCI: '', upperCI: '', weight: '' }), [field]: value } 
        } : a
      )
    }));
  };

  const exportCSV = () => {
    // Generate CSV from fully included articles
    const customHeaders = state.config.extractionFields;
    const headers = [
      "PMID/ID", "Title", "Authors", "Year", "Journal", "DOI/URL", "QA Design", "QA Score", 
      "Population", "Age", "Sex", "Inclusion Criteria", "Exclusion Criteria", "Follow-up", "Setting", "Randomization", "Blinding",
      "Intervention", "Comparator", "Dose", "Frequency", "Duration", "Route", "Treatment Protocol",
      ...customHeaders
    ];
    const rows = fullyIncludedArticles.map(a => {
      const bib = a.bibliographic || {};
      const study = a.studyCharacteristics || {};
      const interv = a.interventionDetails || {};
      
      const row = [
        a.id,
        `"${a.title.replace(/"/g, '""')}"`,
        `"${a.authors.replace(/"/g, '""')}"`,
        a.year,
        `"${a.journal.replace(/"/g, '""')}"`,
        `"${a.url.replace(/"/g, '""')}"`,
        `"${a.qualityAssessment?.design || ""}"`,
        `"${a.qualityAssessment?.score || "Unassessed"}"`,
        `"${(study.population || "").replace(/"/g, '""')}"`,
        `"${(study.age || "").replace(/"/g, '""')}"`,
        `"${(study.sex || "").replace(/"/g, '""')}"`,
        `"${(study.inclusionCriteria || "").replace(/"/g, '""')}"`,
        `"${(study.exclusionCriteria || "").replace(/"/g, '""')}"`,
        `"${(study.followUpPeriod || "").replace(/"/g, '""')}"`,
        `"${(study.setting || "").replace(/"/g, '""')}"`,
        `"${(study.randomization || "").replace(/"/g, '""')}"`,
        `"${(study.blinding || "").replace(/"/g, '""')}"`,
        `"${(interv.intervention || "").replace(/"/g, '""')}"`,
        `"${(interv.comparator || "").replace(/"/g, '""')}"`,
        `"${(interv.dose || "").replace(/"/g, '""')}"`,
        `"${(interv.frequency || "").replace(/"/g, '""')}"`,
        `"${(interv.duration || "").replace(/"/g, '""')}"`,
        `"${(interv.route || "").replace(/"/g, '""')}"`,
        `"${(interv.treatmentProtocol || "").replace(/"/g, '""')}"`,
        ...customHeaders.map(f => `"${((a.customExtraction && a.customExtraction[f]) || "").replace(/"/g, '""')}"`)
      ];
      return row;
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "extracted_data.csv");
    document.body.appendChild(link);
    link.click();
  };

  const exportJSON = () => {
    const jsonContent = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullyIncludedArticles, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", jsonContent);
    link.setAttribute("download", "extracted_data.json");
    document.body.appendChild(link);
    link.click();
  };

  const exportBibTeX = () => {
    let bib = "";
    fullyIncludedArticles.forEach(a => {
      const citeKey = `${a.authors.split(' ')[0].replace(/[^a-zA-Z]/g, '')}${a.year}`;
      bib += `@article{${citeKey},
  title={${a.title}},
  author={${a.authors}},
  journal={${a.journal}},
  year={${a.year}},
  url={${a.url}}
}

`;
    });
    const content = "data:text/plain;charset=utf-8," + encodeURIComponent(bib);
    const link = document.createElement("a");
    link.setAttribute("href", content);
    link.setAttribute("download", "references.bib");
    document.body.appendChild(link);
    link.click();
  };

  const exportRIS = () => {
    let ris = "";
    fullyIncludedArticles.forEach(a => {
      ris += `TY  - JOUR\n`;
      ris += `TI  - ${a.title}\n`;
      
      const authorList = a.authors.split(/,\s*| and /i);
      authorList.forEach(author => {
        if (author.trim()) {
           ris += `AU  - ${author.trim()}\n`;
        }
      });
      
      ris += `JO  - ${a.journal}\n`;
      ris += `PY  - ${a.year}\n`;
      if (a.abstract) {
        ris += `AB  - ${a.abstract}\n`;
      }
      ris += `UR  - ${a.url}\n`;
      ris += `ER  - \n\n`;
    });
    
    const content = "data:text/plain;charset=utf-8," + encodeURIComponent(ris);
    const link = document.createElement("a");
    link.setAttribute("href", content);
    link.setAttribute("download", "references.ris");
    document.body.appendChild(link);
    link.click();
  };

  const exportPDF = () => {
    setIsExportingPDF(true);
    
    // Simulate slight delay to allow UI to render spinner
    setTimeout(() => {
      try {
        const doc = new jsPDF('landscape') as any; // landscape for custom columns
        
        // Cover Page
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        const splitTitle = doc.splitTextToSize(state.config.title, 250);
        doc.text(splitTitle, 14, 40);
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text(`${state.config.reviewType} Report`, 14, 60 + (splitTitle.length - 1) * 10);
        
        if (state.config.reviewerName) {
           doc.text(`Reviewer: ${state.config.reviewerName}`, 14, 80 + (splitTitle.length - 1) * 10);
        }
        if (state.config.affiliation) {
           doc.text(`Affiliation: ${state.config.affiliation}`, 14, 90 + (splitTitle.length - 1) * 10);
        }
        doc.text(`Date of Search: ${state.config.dateOfSearch || new Date().toLocaleDateString()}`, 14, 100 + (splitTitle.length - 1) * 10);
        doc.text(`Date Exported: ${new Date().toLocaleDateString()}`, 14, 110 + (splitTitle.length - 1) * 10);

        doc.addPage();
        
        // Table of Contents
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text("Table of Contents", 14, 22);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text("1. PRISMA Flow Summary", 14, 40);
        doc.text("2. Quality Assessment Summary", 14, 50);
        doc.text("3. Data Extraction Table", 14, 60);
        doc.text("4. Narrative Synthesis", 14, 70);
        doc.text("5. Bibliography", 14, 80);

        doc.addPage();

        // 1. PRISMA Summary text
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("1. PRISMA Flow Summary", 14, 22);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        
        const overrideIdentified = state.prismaOverrides.identified !== undefined ? state.prismaOverrides.identified : state.totalIdentified;
        const overrideDuplicates = state.prismaOverrides.duplicates !== undefined ? state.prismaOverrides.duplicates : state.totalDuplicates;
        const overrideScreened = state.prismaOverrides.screened !== undefined ? state.prismaOverrides.screened : state.articles.length;
        const overrideTitleAbstractExcluded = state.prismaOverrides.titleAbstractExcluded !== undefined ? state.prismaOverrides.titleAbstractExcluded : state.articles.filter(a => a.decision === 'excluded').length;
        const overrideFullTextAssessed = state.prismaOverrides.fullTextAssessed !== undefined ? state.prismaOverrides.fullTextAssessed : includedArticles.length;
        const overrideFullTextExcluded = state.prismaOverrides.fullTextExcluded !== undefined ? state.prismaOverrides.fullTextExcluded : state.articles.filter(a => a.decision === 'included' && a.fullTextDecision === 'excluded').length;
        const overrideIncluded = state.prismaOverrides.included !== undefined ? state.prismaOverrides.included : fullyIncludedArticles.length;

        doc.text(`Records Identified: ${overrideIdentified}`, 14, 35);
        doc.text(`Duplicates Removed: ${overrideDuplicates}`, 14, 42);
        doc.text(`Records Screened: ${overrideScreened}`, 14, 49);
        doc.text(`Records Excluded (Title/Abstract): ${overrideTitleAbstractExcluded}`, 14, 56);
        doc.text(`Full-Text Assessed: ${overrideFullTextAssessed}`, 14, 63);
        doc.text(`Records Excluded (Full-Text): ${overrideFullTextExcluded}`, 14, 70);
        doc.text(`Studies Included: ${overrideIncluded}`, 14, 77);

        // Visual Progress Bar
        const percentScreened = overrideIdentified > 0 ? (overrideScreened / overrideIdentified) * 100 : 0;
        const percentIncluded = overrideScreened > 0 ? (overrideIncluded / overrideScreened) * 100 : 0;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("Pipeline Progress", 14, 95);

        doc.setFillColor(241, 245, 249); // slate-100
        doc.rect(14, 100, 200, 12, 'F');
        
        doc.setFillColor(99, 102, 241); // indigo-500
        doc.rect(14, 100, (percentScreened / 100) * 200, 12, 'F');

        doc.setFillColor(16, 185, 129); // emerald-500
        doc.rect(14, 100, (percentIncluded / 100) * (percentScreened / 100) * 200, 12, 'F');

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text("Retrieved", 14, 118);
        doc.text("Screened", 14 + (percentScreened / 100) * 200 - 20, 118);
        doc.setTextColor(0, 0, 0);

        doc.addPage();

        // 2. Quality Assessment Summary
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("2. Quality Assessment Summary", 14, 22);
        
        const qaHeaders = ['PMID', 'Author', 'Design', 'Risk of Bias Score'];
        const qaData = fullyIncludedArticles.map(a => [
           a.id,
           a.authors.split(";")[0] + " et al.",
           a.qualityAssessment?.design || 'Not specified',
           a.qualityAssessment?.score || 'Unassessed'
        ]);

        autoTable(doc, {
          startY: 30,
          head: [qaHeaders],
          body: qaData,
          styles: { fontSize: 10, font: 'helvetica' },
          headStyles: { fillColor: [41, 128, 185] }
        });

        doc.addPage();

        // 3. Extraction Table
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("3. Data Extraction Table", 14, 22);

        const customHeaders = state.config.extractionFields;
        const tableData = fullyIncludedArticles.map(a => [
          a.id, 
          a.authors.split(";")[0] + " et al.", 
          a.year, 
          ...customHeaders.map(f => (a.customExtraction && a.customExtraction[f]) || '-')
        ]);

        autoTable(doc, {
          startY: 30,
          head: [['PMID', 'Authors', 'Year', ...customHeaders]],
          body: tableData,
          styles: { fontSize: 8, font: 'helvetica' },
          headStyles: { fillColor: [41, 128, 185] }
        });
        
        doc.addPage();
        
        // 4. Narrative Synthesis
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("4. Narrative Synthesis", 14, 22);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        
        const synthesisText = generateNarrativeSynthesis(fullyIncludedArticles, state.config.reviewType);
        const splitText = doc.splitTextToSize(synthesisText, 250); // landscape width
        doc.text(splitText, 14, 35);

        doc.addPage();
        
        // 5. Bibliography
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("5. Bibliography", 14, 22);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        const bibData = fullyIncludedArticles.map((a, i) => [
           `${i + 1}.`,
           `${a.authors} (${a.year}). ${a.title}. ${a.journal}. ${a.doi ? 'doi:' + a.doi : ''}`
        ]);
        
        autoTable(doc, {
          startY: 30,
          head: [['#', 'Citation']],
          body: bibData,
          styles: { fontSize: 10, font: 'helvetica' },
          columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 'auto' }
          },
          headStyles: { fillColor: [41, 128, 185] }
        });

        doc.save("review_report.pdf");
      } catch (e) {
        console.error("PDF Export failed", e);
      } finally {
        setIsExportingPDF(false);
      }
    }, 150);
  };

  const getProjectReadiness = () => {
    const missing = [];
    if (!state.config.title) missing.push("Missing Title");
    if (!state.config.reviewerName) missing.push("Missing Reviewer");
    if (!state.config.inclusionCriteria) missing.push("Missing Inclusion Criteria");
    if (!state.config.exclusionCriteria) missing.push("Missing Exclusion Criteria");
    
    if (fullyIncludedArticles.length === 0) missing.push("No Fully Included Articles");
    
    if (fullyIncludedArticles.length > 0 && fullyIncludedArticles.some(a => !a.qualityAssessment?.score || a.qualityAssessment?.score === 'Unassessed')) {
      missing.push("Incomplete Quality Assessment");
    }
    
    // Check if extraction has occurred
    if (fullyIncludedArticles.length > 0 && fullyIncludedArticles.some(a => !a.studyCharacteristics?.population)) {
       missing.push("Incomplete Data Extraction");
    }
    
    return missing;
  };

  const missingRequirements = getProjectReadiness();
  const isReady = missingRequirements.length === 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 font-sans text-gray-900 dark:text-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-slate-900 dark:bg-indigo-600 flex items-center justify-center text-white font-bold">
            SR
          </div>
          <h1 className="text-xl font-bold tracking-tight font-display text-gray-900 dark:text-white">Scoping Reviewer AI</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
             <button onClick={() => {
                document.documentElement.classList.toggle('dark');
             }} className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition rounded-full hover:bg-gray-100 dark:hover:bg-slate-800">
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
             </button>
            <div className="text-sm font-medium text-gray-500 max-w-lg truncate hidden md:block group relative cursor-pointer">
              <div className="flex items-center space-x-2">
              <span>{state.config.title || "Untitled Project"}</span>
              {isReady ? (
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1" /> Ready for Conference
                </span>
              ) : (
                <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-bold">
                  {missingRequirements.length} actions pending
                </span>
              )}
            </div>
            
            {/* Tooltip for missing requirements */}
            {!isReady && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 text-white text-xs rounded shadow-lg p-3 hidden group-hover:block z-50">
                <p className="font-bold mb-2">Required for Completion:</p>
                <ul className="list-disc pl-4 space-y-1">
                  {missingRequirements.map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>
            )}
            </div>
          </div>
          <button id="help-button" onClick={() => setIsHelpSidebarOpen(!isHelpSidebarOpen)} className={`px-4 py-2 rounded-lg font-medium text-sm transition flex items-center ${isHelpSidebarOpen ? 'bg-slate-900 dark:bg-indigo-600 text-white' : 'bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-slate-700'}`}>
            <HelpCircle className="w-4 h-4 mr-1.5" /> Help
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Nav */}
        <aside className="w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex-shrink-0 flex flex-col pt-6 hidden lg:flex">
          <nav className="flex-1 px-4 space-y-2">
            {STEPS.map(step => (
              <button
                key={step.id}
                id={`step-nav-${step.id}`}
                onClick={() => setCurrentStep(step.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  currentStep === step.id 
                  ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-sm' 
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <step.icon className={`w-5 h-5 ${currentStep === step.id ? 'text-white' : 'text-gray-400 dark:text-slate-500'}`} />
                <span>{step.name}</span>
                {step.id < currentStep && <CheckCircle className="w-4 h-4 ml-auto text-green-500" />}
              </button>
            ))}
          </nav>

          {/* Dashboard Summary */}
          <div className="px-4 pb-4 mt-6">
             <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-3 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center"><Activity className="w-3 h-3 mr-1"/> Workflow Progress</h4>
                <div className="flex justify-between items-center text-xs">
                   <span className="text-slate-600 dark:text-slate-400">Total Retrieved</span>
                   <span className="font-semibold text-slate-900 dark:text-white">{state.totalIdentified}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                   <span className="text-slate-600 dark:text-slate-400">To Screen (T/A)</span>
                   <span className="font-semibold text-yellow-600 dark:text-yellow-400">{pendingArticles.length}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                   <span className="text-slate-600 dark:text-slate-400">To Screen (Full)</span>
                   <span className="font-semibold text-blue-600 dark:text-blue-400">{state.articles.filter(a => a.decision === 'included' && a.fullTextDecision === 'pending').length}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                   <span className="text-slate-600 dark:text-slate-400 font-medium">Included Studies</span>
                   <span className="font-bold text-green-600">{fullyIncludedArticles.length}</span>
                </div>
             </div>
          </div>

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div id="search-history" className="px-4 pb-6 mt-8">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Recent Searches</h4>
              <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1 styled-scrollbar">
                {recentSearches.map(s => (
                  <button 
                     key={s.id}
                     onClick={() => {
                        setState(prev => ({ ...prev, strategy: { ...prev.strategy, builtQuery: s.query } }));
                        setCurrentStep(2);
                     }}
                     className="w-full text-left text-xs text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 p-2.5 rounded border border-slate-100 transition truncate group relative"
                     title={s.query}
                  >
                     <div className="truncate font-mono">{s.query}</div>
                     <div className="text-[10px] text-slate-400 mt-1">{s.date}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-slate-950 p-6 md:p-10">
          <div className="max-w-5xl mx-auto">

            {/* STEP 1: SETUP */}
            {currentStep === 1 && (
              <motion.section initial={{opacity:0, y:15}} animate={{opacity:1, y:0}} className="space-y-8">
                <div className="flex justify-between items-end">
                   <div>
                     <h2 className="text-3xl font-extrabold tracking-tight font-display text-gray-900 dark:text-white">Project Configuration</h2>
                     <p className="text-gray-500 dark:text-gray-400 mt-2">Define your scoping review boundaries, PICO/PCC elements, and timeframes.</p>
                   </div>
                   <div className="w-64">
                     <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Load Template</label>
                     <select 
                       id="template-dropdown"
                       className="w-full bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 border rounded-lg px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-slate-400 focus:outline-none"
                       onChange={(e) => {
                         const t = e.target.value;
                         if (t === 'Prevalence Study') {
                           setState(p => ({ ...p, config: { ...p.config, pcc: { p: 'Population', c: 'Condition', c2: 'Geography/Setting' }, inclusionCriteria: 'Observational studies, cross-sectional studies reporting prevalence data.', exclusionCriteria: 'Case reports, reviews, studies without primary data.', extractionFields: ['Study Design', 'Sample Size', 'Prevalence', 'Diagnostic Criteria', 'Country'] } }));
                         } else if (t === 'Qualitative Evidence Synthesis') {
                           setState(p => ({ ...p, config: { ...p.config, pcc: { p: 'Population', c: 'Phenomenon of Interest', c2: 'Context' }, inclusionCriteria: 'Qualitative studies exploring experiences or perceptions.', exclusionCriteria: 'Quantitative studies, systematic reviews.', extractionFields: ['Methodology', 'Data Collection', 'Themes', 'Setting'] } }));
                         }
                       }}
                     >
                       <option value="">-- Select Template --</option>
                       <option value="Prevalence Study">Prevalence Study</option>
                       <option value="Qualitative Evidence Synthesis">Qualitative Evidence Synthesis</option>
                     </select>
                   </div>
                </div>
                
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Review Title</label>
                    <input 
                      id="project-title-input"
                      type="text" 
                      value={state.config.title}
                      onChange={(e) => updateConfig('title', e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 border rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-slate-400 focus:outline-none"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Year</label>
                      <input 
                        type="text" 
                        value={state.config.startYear}
                        onChange={(e) => updateConfig('startYear', e.target.value)}
                        className="w-full border-gray-300 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-slate-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Year</label>
                      <input 
                        type="text" 
                        value={state.config.endYear}
                        onChange={(e) => updateConfig('endYear', e.target.value)}
                        className="w-full border-gray-300 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                     <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Framework</label>
                        <button 
                           onClick={handleAutoFillFramework} 
                           disabled={!state.config.title || !state.config.inclusionCriteria || isAutoFillingFramework || state.config.frameworkType === 'Custom'}
                           className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3 py-1.5 rounded flex items-center font-medium disabled:opacity-50 transition"
                        >
                           {isAutoFillingFramework ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analyzing...</> : <><Sparkles className="w-3 h-3 mr-1" /> Auto-fill with AI</>}
                        </button>
                     </div>
                     <div className="flex space-x-4 mb-4">
                        {(['PICO', 'PCC', 'Custom'] as const).map(fw => (
                           <label key={fw} className="flex items-center space-x-2">
                              <input 
                                 type="radio" 
                                 name="framework" 
                                 value={fw} 
                                 checked={state.config.frameworkType === fw}
                                 onChange={(e) => updateConfig('frameworkType', e.target.value as any)}
                                 className="text-slate-900 focus:ring-slate-500"
                              />
                              <span className="text-sm text-gray-700 font-medium">{fw}</span>
                           </label>
                        ))}
                     </div>
                     
                     {state.config.frameworkType === 'PICO' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                           <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Population (P)</label>
                              <input id="pico-p-input" type="text" value={state.config.pico.p} onChange={(e) => updateConfig('pico', { ...state.config.pico, p: e.target.value })} className="w-full text-sm border-gray-300 border rounded px-3 py-1.5 focus:ring-2 focus:ring-slate-400 focus:outline-none" />
                           </div>
                           <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Intervention / Exposure (I)</label>
                              <input id="pico-i-input" type="text" value={state.config.pico.i} onChange={(e) => updateConfig('pico', { ...state.config.pico, i: e.target.value })} className="w-full text-sm border-gray-300 border rounded px-3 py-1.5 focus:ring-2 focus:ring-slate-400 focus:outline-none" />
                           </div>
                           <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Comparison (C)</label>
                              <input id="pico-c-input" type="text" value={state.config.pico.c} onChange={(e) => updateConfig('pico', { ...state.config.pico, c: e.target.value })} className="w-full text-sm border-gray-300 border rounded px-3 py-1.5 focus:ring-2 focus:ring-slate-400 focus:outline-none" />
                           </div>
                           <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Outcome (O)</label>
                              <input id="pico-o-input" type="text" value={state.config.pico.o} onChange={(e) => updateConfig('pico', { ...state.config.pico, o: e.target.value })} className="w-full text-sm border-gray-300 border rounded px-3 py-1.5 focus:ring-2 focus:ring-slate-400 focus:outline-none" />
                           </div>
                        </div>
                     )}
                     
                     {state.config.frameworkType === 'PCC' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                           <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Population (P)</label>
                              <input id="pcc-p-input" type="text" value={state.config.pcc.p} onChange={(e) => updateConfig('pcc', { ...state.config.pcc, p: e.target.value })} className="w-full text-sm border-gray-300 border rounded px-3 py-1.5 focus:ring-2 focus:ring-slate-400 focus:outline-none" />
                           </div>
                           <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Concept (C)</label>
                              <input id="pcc-c-input" type="text" value={state.config.pcc.c} onChange={(e) => updateConfig('pcc', { ...state.config.pcc, c: e.target.value })} className="w-full text-sm border-gray-300 border rounded px-3 py-1.5 focus:ring-2 focus:ring-slate-400 focus:outline-none" />
                           </div>
                           <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Context (C)</label>
                              <input id="pcc-c2-input" type="text" value={state.config.pcc.c2} onChange={(e) => updateConfig('pcc', { ...state.config.pcc, c2: e.target.value })} className="w-full text-sm border-gray-300 border rounded px-3 py-1.5 focus:ring-2 focus:ring-slate-400 focus:outline-none" />
                           </div>
                        </div>
                     )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reviewer Name</label>
                      <input 
                        id="reviewer-name-input"
                        type="text" 
                        placeholder="e.g. Dr. Jane Doe"
                        value={state.config.reviewerName || ''}
                        onChange={(e) => updateConfig('reviewerName', e.target.value)}
                        className="w-full border-gray-300 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-slate-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Affiliation</label>
                      <input 
                        type="text" 
                        placeholder="e.g. University of..."
                        value={state.config.affiliation || ''}
                        onChange={(e) => updateConfig('affiliation', e.target.value)}
                        className="w-full border-gray-300 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-slate-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Search</label>
                      <input 
                        type="date" 
                        value={state.config.dateOfSearch || ''}
                        onChange={(e) => updateConfig('dateOfSearch', e.target.value)}
                        className="w-full border-gray-300 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Inclusion Criteria</label>
                      <textarea rows={4}
                        id="inclusion-criteria-input"
                        value={state.config.inclusionCriteria}
                        onChange={(e) => updateConfig('inclusionCriteria', e.target.value)}
                        className="w-full text-sm border-gray-300 border rounded-lg p-3 resize-none focus:ring-2 focus:ring-slate-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Exclusion Criteria</label>
                      <textarea rows={4}
                        id="exclusion-criteria-input"
                        value={state.config.exclusionCriteria}
                        onChange={(e) => updateConfig('exclusionCriteria', e.target.value)}
                        className="w-full text-sm border-gray-300 border rounded-lg p-3 resize-none focus:ring-2 focus:ring-slate-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <label className="block text-sm font-medium text-gray-700">Custom Extraction Fields</label>
                      <button 
                        onClick={() => updateConfig('extractionFields', [...state.config.extractionFields, `Field ${state.config.extractionFields.length + 1}`])}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        + Add Field
                      </button>
                    </div>
                    <div className="space-y-2">
                      {state.config.extractionFields.map((field, idx) => (
                        <div key={idx} className="flex space-x-2">
                          <input 
                            type="text" 
                            value={field}
                            onChange={(e) => {
                              const newFields = [...state.config.extractionFields];
                              newFields[idx] = e.target.value;
                              updateConfig('extractionFields', newFields);
                            }}
                            className="flex-1 border-gray-300 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-slate-400 focus:outline-none"
                          />
                          <button 
                            onClick={() => {
                              const newFields = state.config.extractionFields.filter((_, i) => i !== idx);
                              updateConfig('extractionFields', newFields);
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 border border-gray-300 rounded-lg hover:border-red-200 hover:bg-red-50"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex justify-end">
                    <button onClick={() => setCurrentStep(2)} className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-slate-800 transition">
                      Continue to Retrieval
                    </button>
                  </div>
                </div>
              </motion.section>
            )}

            {/* STEP 2: RETRIEVAL */}
            {currentStep === 2 && (
              <motion.section initial={{opacity:0, y:15}} animate={{opacity:1, y:0}} className="space-y-8">
                <div>
                   <h2 className="text-3xl font-extrabold tracking-tight font-display text-gray-900 dark:text-white">Database Retrieval</h2>
                   <p className="text-gray-500 dark:text-gray-400 mt-2">Construct your search strategy and fetch verifiable records from multiple databases.</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 space-y-6">
                  <div id="database-selector" className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row gap-6 md:items-center">
                    <div className="w-full">
                      <span className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Select Databases</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={selectedDatabases.pubmed} onChange={(e) => setSelectedDatabases(p => ({...p, pubmed: e.target.checked}))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>PubMed</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={selectedDatabases.pmc} onChange={(e) => setSelectedDatabases(p => ({...p, pmc: e.target.checked}))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>PMC</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={selectedDatabases.europePmc} onChange={(e) => setSelectedDatabases(p => ({...p, europePmc: e.target.checked}))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>Europe PMC</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={selectedDatabases.crossref} onChange={(e) => setSelectedDatabases(p => ({...p, crossref: e.target.checked}))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>Crossref</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={selectedDatabases.scopus} onChange={(e) => setSelectedDatabases(p => ({...p, scopus: e.target.checked}))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>Scopus</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={selectedDatabases.webOfScience} onChange={(e) => setSelectedDatabases(p => ({...p, webOfScience: e.target.checked}))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>Web of Science</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={selectedDatabases.semanticScholar} onChange={(e) => setSelectedDatabases(p => ({...p, semanticScholar: e.target.checked}))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>Semantic Scholar</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={selectedDatabases.openalex} onChange={(e) => setSelectedDatabases(p => ({...p, openalex: e.target.checked}))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>ScienceDirect (via OpenAlex)</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={selectedDatabases.doaj} onChange={(e) => setSelectedDatabases(p => ({...p, doaj: e.target.checked}))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>DOAJ</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={selectedDatabases.googleScholar} onChange={(e) => setSelectedDatabases(p => ({...p, googleScholar: e.target.checked}))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>Google Scholar</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={selectedDatabases.clinicalTrials} onChange={(e) => setSelectedDatabases(p => ({...p, clinicalTrials: e.target.checked}))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>ClinicalTrials.gov</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={selectedDatabases.whoIctrp} onChange={(e) => setSelectedDatabases(p => ({...p, whoIctrp: e.target.checked}))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>WHO ICTRP</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={selectedDatabases.cochrane} onChange={(e) => setSelectedDatabases(p => ({...p, cochrane: e.target.checked}))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>Cochrane</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={selectedDatabases.biorxiv} onChange={(e) => setSelectedDatabases(p => ({...p, biorxiv: e.target.checked}))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>bioRxiv</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                          <input type="checkbox" checked={selectedDatabases.medrxiv} onChange={(e) => setSelectedDatabases(p => ({...p, medrxiv: e.target.checked}))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>medRxiv</span>
                        </label>
                      </div>
                    </div>
                    <div className="md:ml-auto mt-4 md:mt-0 flex-shrink-0">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Max Records per Source</label>
                      <select 
                         value={maxResultsLimit} 
                         onChange={(e) => setMaxResultsLimit(Number(e.target.value))}
                         className="bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 border rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-slate-400 focus:outline-none"
                      >
                         <option value={50}>50 Records</option>
                         <option value={100}>100 Records</option>
                         <option value={200}>200 Records</option>
                         <option value={500}>500 Records</option>
                         <option value={1000}>1000 Records (Slow)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concept 1 (Population)</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Supports Boolean, MeSH terms, and wildcards (e.g., <span className="font-mono bg-gray-100 dark:bg-slate-800 p-0.5 rounded">"Diabetes Mellitus"[Mesh] OR diabet*</span>)</p>
                      <textarea rows={3}
                        value={state.strategy.populationTerms}
                        onChange={(e) => setState(p => ({...p, strategy: {...p.strategy, populationTerms: e.target.value}}))}
                        className="w-full text-sm font-mono bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 border rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-slate-400 focus:outline-none"
                      />
                     </div>
                     <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concept 2 (Intervention)</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Supports nested queries and synonyms (e.g., <span className="font-mono bg-gray-100 dark:bg-slate-800 p-0.5 rounded">"Weight Loss" OR "Diet"</span>)</p>
                      <textarea rows={3}
                        value={state.strategy.riskFactorTerms}
                        onChange={(e) => setState(p => ({...p, strategy: {...p.strategy, riskFactorTerms: e.target.value}}))}
                        className="w-full text-sm font-mono bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 border rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-slate-400 focus:outline-none"
                      />
                     </div>
                     <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concept 3 (Outcomes)</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Combine with AND/NOT (e.g., <span className="font-mono bg-gray-100 dark:bg-slate-800 p-0.5 rounded">Mortality OR Survival</span>)</p>
                      <textarea rows={3}
                        value={state.strategy.conceptTerms}
                        onChange={(e) => setState(p => ({...p, strategy: {...p.strategy, conceptTerms: e.target.value}}))}
                        className="w-full text-sm font-mono bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 border rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-slate-400 focus:outline-none"
                      />
                     </div>
                  </div>
                  
                  <div className="flex gap-4 items-center">
                    <button id="query-builder" onClick={handleBuildQuery} className="bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-slate-700">
                      Build Query
                    </button>
                    <div className="flex-1">
                      <input 
                         readOnly 
                         value={state.strategy.builtQuery} 
                         placeholder="Click Build Query..."
                         className="w-full bg-gray-50 dark:bg-slate-800 text-xs font-mono border-gray-300 dark:border-slate-700 border rounded p-2 text-gray-600 dark:text-gray-300"
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                     <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                        {state.isSearching ? (
                          <span className="flex items-center"><Search className="animate-spin w-4 h-4 mr-2"/> {state.searchProgress}</span>
                        ) : state.totalIdentified > 0 ? (
                          <span className="text-green-600 dark:text-green-500 flex items-center"><CheckCircle className="w-4 h-4 mr-2"/> {state.searchProgress}</span>
                        ) : null}
                     </div>
                     <button 
                       id="execute-search-btn"
                       onClick={handleRetrieval}
                       disabled={state.isSearching}
                       className="bg-slate-900 dark:bg-indigo-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-indigo-700 transition shadow-sm flex items-center"
                     >
                       <Play className="w-4 h-4 mr-2" /> Start Retrieval
                     </button>
                  </div>
                </div>
              </motion.section>
            )}

            {/* STEP 3: SCREENING */}
            {currentStep === 3 && (
              <motion.section initial={{opacity:0, y:15}} animate={{opacity:1, y:0}} className="space-y-6 h-full flex flex-col">
                <div>
                   <h2 className="text-3xl font-extrabold tracking-tight font-display text-gray-900 dark:text-white">Title & Abstract Screening</h2>
                   <p className="text-gray-500 dark:text-gray-400 mt-2">Evaluate candidate papers against your inclusion criteria.</p>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                   <div className="flex items-center space-x-4">
                     <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 px-3 py-1 rounded-full font-medium">{pendingArticles.length} Pending</span>
                     <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-3 py-1 rounded-full font-medium">{includedArticles.length} Included</span>
                     <span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 px-3 py-1 rounded-full font-medium">{excludedArticles.length} Excluded</span>
                   </div>
                   <div className="flex items-center space-x-3">
                     {pendingArticles.length > 0 && (
                       <div id="view-mode-toggle" className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
                         <button onClick={() => setScreeningViewMode('individual')} className={`px-3 py-1 rounded-md text-sm font-medium transition ${screeningViewMode === 'individual' ? 'bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>Individual</button>
                         <button onClick={() => setScreeningViewMode('bulk')} className={`px-3 py-1 rounded-md text-sm font-medium transition ${screeningViewMode === 'bulk' ? 'bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>Bulk List</button>
                       </div>
                     )}
                     {pendingArticles.length > 0 && (
                       <button
                         id="auto-screen-btn"
                         onClick={handleAutoScreen}
                         disabled={state.isAutoScreening}
                         className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center shadow-sm text-sm disabled:opacity-50"
                       >
                         {state.isAutoScreening ? (
                           <><Search className="w-4 h-4 mr-2 animate-spin"/> AI Screening...</>
                         ) : (
                           <><Activity className="w-4 h-4 mr-2"/> Auto-Screen with AI</>
                         )}
                       </button>
                     )}
                   </div>
                </div>

                {pendingArticles.length === 0 && (
                  <div className="text-center py-20 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
                    <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Screening Complete!</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">All {state.articles.length} retrieved articles have been screened.</p>
                    <button onClick={() => setCurrentStep(4)} className="mt-6 bg-slate-900 dark:bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-indigo-700 transition">
                      Proceed to Full-Text Screening
                    </button>
                  </div>
                )}

                {pendingArticles.length > 0 && screeningViewMode === 'bulk' && (
                  <div id="manual-screen-list" className="flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden" style={{ height: '600px' }}>
                     <div className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                           <input type="checkbox" 
                              className="rounded text-indigo-600 w-5 h-5"
                              checked={selectedArticleIds.size === pendingArticles.length && pendingArticles.length > 0}
                              onChange={(e) => {
                                 if (e.target.checked) {
                                    setSelectedArticleIds(new Set(pendingArticles.map(a => a.id)));
                                 } else {
                                    setSelectedArticleIds(new Set());
                                 }
                              }}
                           />
                           <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Select All ({selectedArticleIds.size} selected)</span>
                        </div>
                        <div className="flex items-center space-x-3">
                           <input 
                              type="text" 
                              placeholder="Reason (e.g. Wrong Population)"
                              value={bulkExclusionReason}
                              onChange={(e) => setBulkExclusionReason(e.target.value)}
                              className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm w-64 text-gray-900 dark:text-white focus:ring-2 focus:ring-slate-400 focus:outline-none"
                           />
                           <button 
                              onClick={() => {
                                 if (selectedArticleIds.size === 0) return;
                                 setState(p => ({
                                    ...p,
                                    articles: p.articles.map(art => selectedArticleIds.has(art.id) ? { ...art, decision: 'excluded', exclusionReason: bulkExclusionReason } : art)
                                 }));
                                 setSelectedArticleIds(new Set());
                              }}
                              disabled={selectedArticleIds.size === 0}
                              className="bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-800/50 px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50 transition"
                           >
                              Exclude Selected
                           </button>
                           <button 
                              onClick={() => {
                                 if (selectedArticleIds.size === 0) return;
                                 setState(p => ({
                                    ...p,
                                    articles: p.articles.map(art => selectedArticleIds.has(art.id) ? { ...art, decision: 'included' } : art)
                                 }));
                                 setSelectedArticleIds(new Set());
                              }}
                              disabled={selectedArticleIds.size === 0}
                              className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50 transition"
                           >
                              Include Selected
                           </button>
                        </div>
                     </div>
                     <div className="flex-1 overflow-y-auto p-0">
                        <table className="w-full text-left text-sm border-collapse">
                           <thead className="bg-white dark:bg-slate-900 sticky top-0 border-b border-gray-200 dark:border-slate-800 shadow-sm">
                              <tr>
                                 <th className="p-4 w-12 border-b dark:border-slate-800"></th>
                                 <th className="p-4 font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-slate-800">Title</th>
                                 <th className="p-4 font-semibold text-gray-700 dark:text-gray-300 w-48 border-b dark:border-slate-800">Authors</th>
                                 <th className="p-4 font-semibold text-gray-700 dark:text-gray-300 w-32 border-b dark:border-slate-800">Year</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                              {pendingArticles.map(art => (
                                 <tr key={art.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                                    <td className="p-4">
                                       <input type="checkbox" 
                                          className="rounded text-indigo-600 w-5 h-5"
                                          checked={selectedArticleIds.has(art.id)}
                                          onChange={(e) => {
                                             const newSet = new Set(selectedArticleIds);
                                             if (e.target.checked) newSet.add(art.id);
                                             else newSet.delete(art.id);
                                             setSelectedArticleIds(newSet);
                                          }}
                                       />
                                    </td>
                                    <td className="p-4 pr-8">
                                       <p className="font-medium text-gray-900 dark:text-white mb-1">{art.title}</p>
                                       <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{art.abstract}</p>
                                    </td>
                                    <td className="p-4 text-gray-600 dark:text-gray-400 text-xs">{art.authors}</td>
                                    <td className="p-4 text-gray-600 dark:text-gray-400">{art.year}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
                )}

                {pendingArticles.length > 0 && screeningViewMode === 'individual' && (
                  <div id="manual-screen-list" className="flex bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden" style={{ height: '600px' }}>
                    {/* Read pane */}
                    <div className="flex-1 p-8 overflow-y-auto border-r border-gray-100 dark:border-slate-800">
                       <div className="text-xs font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase mb-2">Reviewing 1 of {pendingArticles.length}</div>
                       <h3 className="text-2xl font-bold text-gray-900 dark:text-white leading-snug mb-4 font-display">{pendingArticles[0].title}</h3>
                       <div className="flex flex-wrap gap-x-4 text-sm text-gray-600 dark:text-gray-400 mb-6 pb-6 border-b border-gray-100 dark:border-slate-800">
                         <p><span className="font-semibold">Authors:</span> {pendingArticles[0].authors}</p>
                         <p><span className="font-semibold">Journal:</span> {pendingArticles[0].journal} ({pendingArticles[0].year})</p>
                         <p><span className="font-semibold">PMID:</span> {pendingArticles[0].id}</p>
                         <p><a href={pendingArticles[0].url} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline">View Source &rarr;</a></p>
                       </div>
                       <div>
                         <h4 className="font-bold text-gray-900 dark:text-white mb-2">Abstract</h4>
                         <p className="text-gray-700 dark:text-gray-300 leading-relaxed max-w-none text-base">{pendingArticles[0].abstract || "No abstract available."}</p>
                       </div>
                    </div>
                    {/* Action pane */}
                    <div className="w-72 bg-gray-50 dark:bg-slate-800 p-6 flex flex-col justify-center space-y-4">
                       <h4 className="font-bold text-gray-900 dark:text-white mb-2 text-center">Eligibility Decision</h4>
                       <button 
                         onClick={() => handleScreeningDecision(pendingArticles[0].id, 'included')}
                         className="w-full bg-emerald-600 dark:bg-emerald-700 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 dark:hover:bg-emerald-600 hover:scale-[1.02] transition-all flex items-center justify-center shadow-sm"
                       >
                         <CheckCircle className="w-5 h-5 mr-2"/> Include
                       </button>
                       <div className="relative flex items-center py-2">
                         <div className="flex-grow border-t border-gray-300 dark:border-slate-600"></div>
                         <span className="flex-shrink-0 mx-4 text-gray-400 dark:text-gray-500 text-sm">Or</span>
                         <div className="flex-grow border-t border-gray-300 dark:border-slate-600"></div>
                       </div>
                       <button 
                         onClick={() => handleScreeningDecision(pendingArticles[0].id, 'excluded', 'Does not meet criteria')}
                         className="w-full bg-white dark:bg-slate-700 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 py-4 rounded-xl font-bold text-lg hover:bg-rose-50 dark:hover:bg-slate-600 hover:border-rose-300 transition-all flex items-center justify-center"
                       >
                         <XCircle className="w-5 h-5 mr-2"/> Exclude
                       </button>
                    </div>
                  </div>
                )}
              </motion.section>
            )}

            {/* STEP 4: FULL-TEXT SCREENING */}
            {currentStep === 4 && (
              <motion.section initial={{opacity:0, y:15}} animate={{opacity:1, y:0}} className="space-y-6 h-full flex flex-col">
                <div>
                   <h2 className="text-3xl font-extrabold tracking-tight font-display text-gray-900 dark:text-white">Full-Text Screening</h2>
                   <p className="text-gray-500 dark:text-gray-400 mt-2">Evaluate the full text of included papers against your criteria.</p>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                   <div className="flex items-center space-x-4">
                     <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 px-3 py-1 rounded-full font-medium">{state.articles.filter(a => a.decision === 'included' && a.fullTextDecision === 'pending').length} Pending</span>
                     <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-3 py-1 rounded-full font-medium">{state.articles.filter(a => a.decision === 'included' && a.fullTextDecision === 'included').length} Included</span>
                     <span className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 px-3 py-1 rounded-full font-medium">{state.articles.filter(a => a.decision === 'included' && a.fullTextDecision === 'excluded').length} Excluded</span>
                   </div>
                   <div className="flex items-center space-x-3">
                     {state.articles.filter(a => a.decision === 'included' && a.fullTextDecision === 'pending').length > 0 && (
                       <div className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
                         <button onClick={() => setScreeningViewMode('individual')} className={`px-3 py-1 rounded-md text-sm font-medium transition ${screeningViewMode === 'individual' ? 'bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>Individual</button>
                         <button onClick={() => setScreeningViewMode('bulk')} className={`px-3 py-1 rounded-md text-sm font-medium transition ${screeningViewMode === 'bulk' ? 'bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>Bulk List</button>
                       </div>
                     )}
                   </div>
                </div>

                {state.articles.filter(a => a.decision === 'included' && a.fullTextDecision === 'pending').length === 0 ? (
                  <div className="text-center py-20 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl">
                    <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Full-Text Screening Complete!</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">All candidates have been evaluated.</p>
                    <button onClick={() => setCurrentStep(5)} className="mt-6 bg-slate-900 dark:bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-indigo-700 transition">
                      Proceed to Quality Assessment
                    </button>
                  </div>
                ) : (() => {
                  const pendingFtArticles = state.articles.filter(a => a.decision === 'included' && a.fullTextDecision === 'pending');
                  const pending = pendingFtArticles[0];
                  return (
                  <>
                  {screeningViewMode === 'bulk' && (
                    <div id="full-text-review" className="flex flex-col bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden" style={{ height: '600px' }}>
                     <div className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                           <input type="checkbox" 
                              className="rounded text-indigo-600 w-5 h-5"
                              checked={selectedArticleIds.size === pendingFtArticles.length && pendingFtArticles.length > 0}
                              onChange={(e) => {
                                 if (e.target.checked) {
                                    setSelectedArticleIds(new Set(pendingFtArticles.map(a => a.id)));
                                 } else {
                                    setSelectedArticleIds(new Set());
                                 }
                              }}
                           />
                           <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Select All ({selectedArticleIds.size} selected)</span>
                        </div>
                        <div className="flex items-center space-x-3">
                           <input 
                              type="text" 
                              placeholder="Reason (e.g. Wrong Outcomes)"
                              value={bulkExclusionReason}
                              onChange={(e) => setBulkExclusionReason(e.target.value)}
                              className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm w-64 text-gray-900 dark:text-white focus:ring-2 focus:ring-slate-400 focus:outline-none"
                           />
                           <button 
                              onClick={() => {
                                 if (selectedArticleIds.size === 0) return;
                                 setState(p => ({
                                    ...p,
                                    articles: p.articles.map(art => selectedArticleIds.has(art.id) ? { ...art, fullTextDecision: 'excluded', fullTextExclusionReason: bulkExclusionReason } : art)
                                 }));
                                 setSelectedArticleIds(new Set());
                              }}
                              disabled={selectedArticleIds.size === 0}
                              className="bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-800/50 px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50 transition"
                           >
                              Exclude Selected
                           </button>
                           <button 
                              onClick={() => {
                                 if (selectedArticleIds.size === 0) return;
                                 setState(p => ({
                                    ...p,
                                    articles: p.articles.map(art => selectedArticleIds.has(art.id) ? { ...art, fullTextDecision: 'included' } : art)
                                 }));
                                 setSelectedArticleIds(new Set());
                              }}
                              disabled={selectedArticleIds.size === 0}
                              className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 px-4 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50 transition"
                           >
                              Include Selected
                           </button>
                        </div>
                     </div>
                     <div className="flex-1 overflow-y-auto p-0">
                        <table className="w-full text-left text-sm border-collapse">
                           <thead className="bg-white dark:bg-slate-900 sticky top-0 border-b border-gray-200 dark:border-slate-800 shadow-sm">
                              <tr>
                                 <th className="p-4 w-12 border-b dark:border-slate-800"></th>
                                 <th className="p-4 font-semibold text-gray-700 dark:text-gray-300 border-b dark:border-slate-800">Title</th>
                                 <th className="p-4 font-semibold text-gray-700 dark:text-gray-300 w-48 border-b dark:border-slate-800">Authors</th>
                                 <th className="p-4 font-semibold text-gray-700 dark:text-gray-300 w-32 border-b dark:border-slate-800">Year</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                              {pendingFtArticles.map(art => (
                                 <tr key={art.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                                    <td className="p-4">
                                       <input type="checkbox" 
                                          className="rounded text-indigo-600 w-5 h-5"
                                          checked={selectedArticleIds.has(art.id)}
                                          onChange={(e) => {
                                             const newSet = new Set(selectedArticleIds);
                                             if (e.target.checked) newSet.add(art.id);
                                             else newSet.delete(art.id);
                                             setSelectedArticleIds(newSet);
                                          }}
                                       />
                                    </td>
                                    <td className="p-4 pr-8">
                                       <p className="font-medium text-gray-900 dark:text-white mb-1"><a href={art.url} target="_blank" className="hover:underline">{art.title}</a></p>
                                       <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{art.abstract}</p>
                                    </td>
                                    <td className="p-4 text-gray-600 dark:text-gray-400 text-xs">{art.authors}</td>
                                    <td className="p-4 text-gray-600 dark:text-gray-400">{art.year}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                    </div>
                  )}

                  {screeningViewMode === 'individual' && (
                  <div id="full-text-review" className="flex bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden" style={{ height: '600px' }}>
                    {/* Read pane */}
                    <div className="flex-1 p-8 overflow-y-auto border-r border-gray-100 dark:border-slate-800">
                       <div className="text-xs font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase mb-2">Reviewing 1 of {state.articles.filter(a => a.decision === 'included' && a.fullTextDecision === 'pending').length}</div>
                       <h3 className="text-2xl font-bold text-gray-900 dark:text-white leading-snug mb-4 font-display">{pending.title}</h3>
                       <div className="flex flex-wrap gap-x-4 text-sm text-gray-600 dark:text-gray-400 mb-6 pb-6 border-b border-gray-100 dark:border-slate-800">
                         <p><span className="font-semibold">Authors:</span> {pending.authors}</p>
                         <p><span className="font-semibold">Journal:</span> {pending.journal} ({pending.year})</p>
                         <p><span className="font-semibold">PMID:</span> {pending.id}</p>
                         <p><a href={pending.url} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline">View Source / PDF &rarr;</a></p>
                       </div>
                       <div>
                         <h4 className="font-bold text-gray-900 dark:text-white mb-2">Abstract (Proxy for Full Text here)</h4>
                         <p className="text-gray-700 dark:text-gray-300 leading-relaxed max-w-none text-base">{pending.abstract || "No abstract available."}</p>
                       </div>
                    </div>
                    {/* Action pane */}
                    <div className="w-72 bg-gray-50 dark:bg-slate-800 p-6 flex flex-col justify-center space-y-4">
                       <h4 className="font-bold text-gray-900 dark:text-white mb-2 text-center">Full-Text Decision</h4>
                       <button 
                         onClick={() => {
                            setState(p => ({
                              ...p, 
                              articles: p.articles.map(a => a.id === pending.id ? { ...a, fullTextDecision: 'included' } : a)
                            }))
                         }}
                         className="w-full bg-emerald-600 dark:bg-emerald-700 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 dark:hover:bg-emerald-600 hover:scale-[1.02] transition-all flex items-center justify-center shadow-sm"
                       >
                         <CheckCircle className="w-5 h-5 mr-2"/> Include
                       </button>
                       <div className="relative flex items-center py-2">
                         <div className="flex-grow border-t border-gray-300 dark:border-slate-600"></div>
                         <span className="flex-shrink-0 mx-4 text-gray-400 dark:text-gray-500 text-sm">Or</span>
                         <div className="flex-grow border-t border-gray-300 dark:border-slate-600"></div>
                       </div>
                       <button 
                         onClick={() => {
                            setState(p => ({
                              ...p, 
                              articles: p.articles.map(a => a.id === pending.id ? { ...a, fullTextDecision: 'excluded', fullTextExclusionReason: 'Full-text exclusion' } : a)
                            }))
                         }}
                         className="w-full bg-white dark:bg-slate-700 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 py-4 rounded-xl font-bold text-lg hover:bg-rose-50 dark:hover:bg-slate-600 hover:border-rose-300 transition-all flex items-center justify-center"
                       >
                         <XCircle className="w-5 h-5 mr-2"/> Exclude
                       </button>
                    </div>
                  </div>

                  )}
                  </>
                  );
                })()}
              </motion.section>
            )}

            {/* STEP 5: QUALITY ASSESSMENT */}
            {currentStep === 5 && (
              <motion.section initial={{opacity:0, y:15}} animate={{opacity:1, y:0}} className="space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-3xl font-extrabold tracking-tight font-display text-gray-900 dark:text-white">Quality Assessment</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Assess the risk of bias for the {fullyIncludedArticles.length} fully included studies.</p>
                  </div>
                  <button onClick={() => setCurrentStep(6)} className="bg-slate-900 dark:bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-indigo-700 transition">
                    Proceed to Extraction
                  </button>
                </div>
                
                <div id="qa-table" className="space-y-6">
                   {fullyIncludedArticles.length === 0 ? (
                      <div className="text-center py-12 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-gray-500 dark:text-gray-400">No studies included for assessment.</div>
                   ) : fullyIncludedArticles.map(a => (
                      <div key={a.id} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-6">
                         <h4 className="font-bold text-lg text-gray-900 dark:text-white mb-1">{a.title}</h4>
                         <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{a.authors.split(';')[0]} et al. ({a.year})</p>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Study Design</label>
                               <select 
                                 className="w-full bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-700 border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-slate-400 focus:outline-none"
                                 value={a.qualityAssessment?.design || ''}
                                 onChange={(e) => {
                                    const val = e.target.value as any;
                                    let initialChecklist: Record<string, boolean | 'Unclear' | 'Not Applicable'> = {};
                                    if (val === 'Randomised') {
                                      initialChecklist = { "Random sequence generation": "Unclear", "Allocation concealment": "Unclear", "Blinding of participants": "Unclear", "Incomplete outcome data": "Unclear" };
                                    } else if (val === 'Non-randomised' || val === 'Observational') {
                                      initialChecklist = { "Confounding bias": "Unclear", "Selection bias": "Unclear", "Information bias": "Unclear", "Reporting bias": "Unclear" };
                                    }

                                    setState(p => ({
                                      ...p,
                                      articles: p.articles.map(art => art.id === a.id ? { 
                                         ...art, 
                                         qualityAssessment: { ...(art.qualityAssessment || { score: 'Unassessed' }), checklist: initialChecklist, design: val } 
                                      } : art)
                                    }))
                                 }}
                               >
                                  <option value="" disabled>Select design...</option>
                                  <option value="Randomised">Randomised Trial</option>
                                  <option value="Non-randomised">Non-randomised Trial</option>
                                  <option value="Observational">Observational / Cross-sectional</option>
                                  <option value="Other">Other</option>
                               </select>
                            </div>
                            
                            {a.qualityAssessment?.design && (
                               <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Risk of Bias Score</label>
                                  <select 
                                     className="w-full bg-gray-50 dark:bg-slate-800 border-gray-300 dark:border-slate-700 border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-slate-400 focus:outline-none"
                                     value={a.qualityAssessment?.score || 'Unassessed'}
                                     onChange={(e) => {
                                        const val = e.target.value as any;
                                        setState(p => ({
                                          ...p,
                                          articles: p.articles.map(art => art.id === a.id ? { 
                                             ...art, 
                                             qualityAssessment: { ...(art.qualityAssessment || { design: '', checklist: {} }), score: val } 
                                          } : art)
                                        }))
                                     }}
                                  >
                                     <option value="Unassessed">Unassessed</option>
                                     <option value="Low Risk">Low Risk</option>
                                     <option value="Moderate Risk">Moderate Risk</option>
                                     <option value="High Risk">High Risk</option>
                                  </select>
                               </div>
                            )}
                         </div>

                         {a.qualityAssessment?.design && Object.keys(a.qualityAssessment.checklist || {}).length > 0 && (
                            <div className="mt-6 border-t border-gray-100 dark:border-slate-800 pt-4">
                               <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Domain Assessment ({(a.qualityAssessment.design === 'Randomised' ? 'RoB 2' : 'ROBINS-I / MINORS')})</h5>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {Object.entries(a.qualityAssessment.checklist).map(([item, status]) => (
                                     <div key={item} className="flex flex-col space-y-1">
                                        <span className="text-xs text-gray-600 dark:text-gray-400">{item}</span>
                                        <select
                                           className="w-full bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 border rounded-md px-2 py-1 text-xs text-gray-900 dark:text-white"
                                           value={String(status)}
                                           onChange={(e) => {
                                              const val = e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value;
                                              setState(p => ({
                                                ...p,
                                                articles: p.articles.map(art => {
                                                   if (art.id === a.id && art.qualityAssessment) {
                                                      return {
                                                         ...art,
                                                         qualityAssessment: {
                                                            ...art.qualityAssessment,
                                                            checklist: {
                                                               ...art.qualityAssessment.checklist,
                                                               [item]: val
                                                            }
                                                         }
                                                      }
                                                   }
                                                   return art;
                                                })
                                              }))
                                           }}
                                        >
                                           <option value="Unclear">Unclear Risk</option>
                                           <option value="false">Low Risk</option>
                                           <option value="true">High Risk</option>
                                           <option value="Not Applicable">Not Applicable</option>
                                        </select>
                                     </div>
                                  ))}
                               </div>
                            </div>
                         )}
                      </div>
                   ))}
                </div>
              </motion.section>
            )}

            {/* STEP 6: EXTRACTION */}
            {currentStep === 6 && (
              <motion.section initial={{opacity:0, y:15}} animate={{opacity:1, y:0}} className="space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-3xl font-extrabold tracking-tight font-display text-gray-900 dark:text-white">Data Extraction</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Chart the evidence from all {fullyIncludedArticles.length} included studies.</p>
                  </div>
                  <button onClick={() => setCurrentStep(7)} className="bg-slate-900 dark:bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-indigo-700 transition">
                    View Synthesis
                  </button>
                </div>

                <div id="extraction-table" className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-x-auto">
                   <table className="w-full text-sm text-left align-top">
                     <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-gray-200 dark:border-slate-700 text-xs uppercase tracking-wider">
                       <tr>
                         <th className="px-6 py-4 font-semibold w-64">Study Detail</th>
                         {state.config.extractionFields.map((field, idx) => (
                            <th key={idx} className="px-6 py-4 font-semibold">{field}</th>
                         ))}
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                       {fullyIncludedArticles.length === 0 && (
                         <tr><td colSpan={state.config.extractionFields.length + 1} className="p-8 text-center text-gray-500 dark:text-gray-400">No studies included for extraction yet.</td></tr>
                       )}
                       {fullyIncludedArticles.map((a, mapIdx) => (
                         <tr key={a.id} className="group hover:bg-gray-50/50 dark:hover:bg-slate-800/50">
                           <td className="px-6 py-4 min-w-[200px]">
                             <div className="font-medium text-gray-900 dark:text-white line-clamp-2" title={a.title}>{a.title}</div>
                             <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{a.authors.split(";")[0]} et al. ({a.year})</div>
                             <button 
                               id={`advanced-extraction-btn-${mapIdx}`}
                               onClick={() => setExtractionModalArticleId(a.id)}
                               className="mt-3 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
                             >
                               Advanced Extraction
                             </button>
                           </td>
                           {state.config.extractionFields.map((field, idx) => (
                             <td key={idx} className="px-4 py-2 min-w-[200px]">
                               <textarea 
                                 className="w-full text-sm bg-white/50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 border rounded p-2 text-gray-900 dark:text-white focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition resize-none styled-scrollbar" 
                                 rows={3}
                                 placeholder={`Enter ${field.toLowerCase()}...`}
                                 value={(a.customExtraction && a.customExtraction[field]) || ''}
                                 onChange={e => updateCustomExtraction(a.id, field, e.target.value)}
                               />
                             </td>
                           ))}
                         </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
              </motion.section>
            )}

            {/* STEP 7: SYNTHESIS & EXPORT */}
            {currentStep === 7 && (
              <motion.section initial={{opacity:0, y:15}} animate={{opacity:1, y:0}} className="space-y-8">
                <div className="flex justify-between items-end">
                   <div>
                     <h2 className="text-3xl font-extrabold tracking-tight font-display text-gray-900 dark:text-white">Final Synthesis & Report</h2>
                     <p className="text-gray-500 dark:text-gray-400 mt-2">Export your PRISMA flowchart and evidence map.</p>
                   </div>
                   <div className="flex space-x-3 flex-wrap gap-y-2">
                     <button id="edit-prisma-btn" onClick={() => setIsPrismaModalOpen(true)} className="bg-white dark:bg-slate-800 border text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-700 px-5 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition shadow-sm flex items-center">
                        <ListChecks className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400"/> Edit PRISMA
                     </button>
                     <button id="preview-export-btn" onClick={() => setIsExportPreviewOpen(true)} className="bg-indigo-50 dark:bg-indigo-900/30 border text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 px-4 py-2.5 rounded-lg font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition shadow-sm flex items-center">
                        <Search className="w-4 h-4 mr-2"/> Preview Export
                     </button>
                     <button id="export-csv-btn" onClick={exportCSV} className="bg-white dark:bg-slate-800 border text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition shadow-sm flex items-center">
                        <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600 dark:text-green-500"/> CSV
                     </button>
                     <button onClick={exportJSON} className="bg-white dark:bg-slate-800 border text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition shadow-sm flex items-center">
                        <Code className="w-4 h-4 mr-2 text-yellow-600 dark:text-yellow-500"/> JSON
                     </button>
                     <button onClick={exportBibTeX} className="bg-white dark:bg-slate-800 border text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition shadow-sm flex items-center">
                        <BookMarked className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-500"/> BibTeX
                     </button>
                     <button onClick={exportRIS} className="bg-white dark:bg-slate-800 border text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition shadow-sm flex items-center">
                        <BookMarked className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-500"/> RIS / EndNote
                     </button>
                     <button id="export-pdf-btn" onClick={exportPDF} disabled={isExportingPDF} className="bg-slate-900 dark:bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-indigo-700 transition shadow-sm flex items-center disabled:opacity-50 min-w-[190px] justify-center">
                        {isExportingPDF ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Generating...</>
                        ) : (
                          <><Download className="w-4 h-4 mr-2"/> Export PDF Report</>
                        )}
                     </button>
                   </div>
                </div>

                <div id="prisma-export" className="pb-10 space-y-8">
                   <PRISMADiagram counts={{
                     identified: state.prismaOverrides.identified !== undefined ? state.prismaOverrides.identified : state.totalIdentified,
                     duplicates: state.prismaOverrides.duplicates !== undefined ? state.prismaOverrides.duplicates : state.totalDuplicates,
                     screened: state.prismaOverrides.screened !== undefined ? state.prismaOverrides.screened : state.articles.length,
                     titleAbstractExcluded: state.prismaOverrides.titleAbstractExcluded !== undefined ? state.prismaOverrides.titleAbstractExcluded : excludedArticles.length,
                     fullTextAssessed: state.prismaOverrides.fullTextAssessed !== undefined ? state.prismaOverrides.fullTextAssessed : includedArticles.length,
                     fullTextExcluded: state.prismaOverrides.fullTextExcluded !== undefined ? state.prismaOverrides.fullTextExcluded : state.articles.filter(a => a.decision === 'included' && a.fullTextDecision === 'excluded').length,
                     included: state.prismaOverrides.included !== undefined ? state.prismaOverrides.included : fullyIncludedArticles.length
                   }} />
                   
                   {fullyIncludedArticles.length > 0 && (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Study Designs Bar Chart */}
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
                           <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 font-display">Study Designs Frequency</h3>
                           <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                 <BarChart data={Object.entries(fullyIncludedArticles.reduce((acc, curr) => {
                                    const design = curr.qualityAssessment?.design || 'Not Specified';
                                    acc[design] = (acc[design] || 0) + 1;
                                    return acc;
                                 }, {} as Record<string, number>)).map(([name, count]) => ({ name, count }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="name" tick={{fontSize: 12, fill: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280'}} />
                                    <YAxis tick={{fontSize: 12, fill: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280'}} allowDecimals={false} />
                                    <RechartsTooltip cursor={{fill: document.documentElement.classList.contains('dark') ? '#334155' : '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff', color: document.documentElement.classList.contains('dark') ? '#fff' : '#000'}} />
                                    <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                                 </BarChart>
                              </ResponsiveContainer>
                           </div>
                        </motion.div>

                        {/* Risk of Bias Pie Chart */}
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
                           <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 font-display">Risk of Bias Distribution</h3>
                           <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                 <PieChart>
                                    <Pie
                                       data={Object.entries(fullyIncludedArticles.reduce((acc, curr) => {
                                          const score = curr.qualityAssessment?.score || 'Unassessed';
                                          acc[score] = (acc[score] || 0) + 1;
                                          return acc;
                                       }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }))}
                                       cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                                    >
                                       {Object.entries(fullyIncludedArticles.reduce((acc, curr) => {
                                          const score = curr.qualityAssessment?.score || 'Unassessed';
                                          acc[score] = (acc[score] || 0) + 1;
                                          return acc;
                                       }, {} as Record<string, number>)).map(([name, _], index) => {
                                          const colors: Record<string, string> = {
                                             'Low Risk': '#10b981',
                                             'Moderate Risk': '#f59e0b',
                                             'High Risk': '#ef4444',
                                             'Unassessed': document.documentElement.classList.contains('dark') ? '#475569' : '#94a3b8'
                                          };
                                          return <Cell key={`cell-${index}`} fill={colors[name] || (document.documentElement.classList.contains('dark') ? '#475569' : '#94a3b8')} />;
                                       })}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff', color: document.documentElement.classList.contains('dark') ? '#fff' : '#000'}} />
                                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{fontSize: '12px', color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280'}}/>
                                 </PieChart>
                              </ResponsiveContainer>
                           </div>
                        </motion.div>
                     </div>
                   )}

                   <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
                     <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 font-display">Automated Narrative Synthesis</h3>
                     {fullyIncludedArticles.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">No included articles to synthesize.</p>
                     ) : (
                        <div className="space-y-4">
                           {generateNarrativeSynthesis(fullyIncludedArticles, state.config.reviewType).split('\n\n').map((paragraph, i) => (
                              <p key={i} className="text-gray-700 dark:text-gray-300 leading-relaxed text-[15px]">{paragraph}</p>
                           ))}
                        </div>
                     )}
                   </div>

                   <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
                     <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 font-display">GRADE Certainty Assessment</h3>
                     <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Assess the certainty of evidence for each outcome.</p>
                     
                     <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                           <thead>
                              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300">
                                 <th className="px-4 py-3 font-semibold">Outcome</th>
                                 <th className="px-4 py-3 font-semibold">Risk of Bias</th>
                                 <th className="px-4 py-3 font-semibold">Inconsistency</th>
                                 <th className="px-4 py-3 font-semibold">Indirectness</th>
                                 <th className="px-4 py-3 font-semibold">Imprecision</th>
                                 <th className="px-4 py-3 font-semibold">Publication Bias</th>
                                 <th className="px-4 py-3 font-semibold bg-indigo-50 dark:bg-indigo-900/30">Certainty</th>
                                 <th className="px-4 py-3 font-semibold">Importance</th>
                                 <th className="px-4 py-3 font-semibold"></th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                              {state.gradeAssessments.map(grade => (
                                 <tr key={grade.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="px-4 py-2">
                                       <input type="text" className="w-40 text-sm bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 rounded text-gray-900 dark:text-white focus:ring-slate-500 focus:border-slate-500" placeholder="e.g. Mortality" value={grade.outcome} onChange={e => updateGradeAssessment(grade.id, 'outcome', e.target.value)} />
                                    </td>
                                    {['riskOfBias', 'inconsistency', 'indirectness', 'imprecision', 'publicationBias'].map(field => (
                                       <td key={field} className="px-4 py-2">
                                          <select className="w-32 text-sm bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 rounded text-gray-900 dark:text-white focus:ring-slate-500 focus:border-slate-500" value={grade[field as keyof GradeAssessment]} onChange={e => updateGradeAssessment(grade.id, field as keyof GradeAssessment, e.target.value)}>
                                             <option value="">Select...</option>
                                             <option value="Not Serious">Not Serious</option>
                                             <option value="Serious">Serious</option>
                                             <option value="Very Serious">Very Serious</option>
                                          </select>
                                       </td>
                                    ))}
                                    <td className="px-4 py-2 bg-indigo-50/30 dark:bg-indigo-900/10">
                                       <select className="w-28 text-sm bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-800 rounded text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500 font-semibold" value={grade.certainty} onChange={e => updateGradeAssessment(grade.id, 'certainty', e.target.value)}>
                                          <option value="">Select...</option>
                                          <option value="High">High ⊕⊕⊕⊕</option>
                                          <option value="Moderate">Moderate ⊕⊕⊕⊝</option>
                                          <option value="Low">Low ⊕⊕⊝⊝</option>
                                          <option value="Very Low">Very Low ⊕⊝⊝⊝</option>
                                       </select>
                                    </td>
                                    <td className="px-4 py-2">
                                       <select className="w-28 text-sm bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 rounded text-gray-900 dark:text-white focus:ring-slate-500 focus:border-slate-500" value={grade.importance} onChange={e => updateGradeAssessment(grade.id, 'importance', e.target.value)}>
                                          <option value="">Select...</option>
                                          <option value="Critical">Critical</option>
                                          <option value="Important">Important</option>
                                          <option value="Not Important">Not Important</option>
                                       </select>
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                       <button onClick={() => deleteGradeAssessment(grade.id)} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition">
                                          <XCircle className="w-4 h-4" />
                                       </button>
                                    </td>
                                 </tr>
                              ))}
                              {state.gradeAssessments.length === 0 && (
                                 <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                       No GRADE assessments added yet.
                                    </td>
                                 </tr>
                              )}
                           </tbody>
                        </table>
                     </div>
                     <button onClick={addGradeAssessment} className="mt-4 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center transition">
                        + Add Outcome Assessment
                     </button>
                   </div>
                </div>
              </motion.section>
            )}

          </div>
        </main>
        
        {/* Help Sidebar */}
        {isHelpSidebarOpen && (
          <aside className="w-80 lg:w-96 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 flex-shrink-0 flex flex-col shadow-xl z-40 relative">
             <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center">
                   <HelpCircle className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" /> Stage Guide
                </h3>
                <button onClick={() => setIsHelpSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                   <XCircle className="w-5 h-5" />
                </button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-6 styled-scrollbar pb-12">
                {HELP_GUIDE.map((guide, idx) => {
                   const isActive = guide.step === currentStep;
                   return (
                      <div key={idx} className={`p-5 rounded-xl border transition-all ${isActive ? 'bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 shadow-sm ring-1 ring-indigo-500/10' : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 opacity-60 hover:opacity-100'}`}>
                         <div className="flex items-center justify-between mb-3">
                            <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>Step {guide.step}</span>
                            {isActive && <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">Current Stage</span>}
                         </div>
                         <h4 className="font-bold text-gray-900 dark:text-white mb-4">{guide.title}</h4>
                         <div className="space-y-4">
                            <div>
                               <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Required Actions</p>
                               <ul className="space-y-3">
                                  {guide.actions.map((act, i) => (
                                     <li key={i} className="text-sm">
                                        <div className="flex items-start">
                                           <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 mr-3 ${act.type === 'button' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300'}`}>
                                              {act.type === 'button' ? <Play className="w-3 h-3" /> : <Code className="w-3 h-3" />}
                                           </div>
                                           <div>
                                              <span className="font-semibold text-gray-900 dark:text-white block mb-0.5">{act.label}</span>
                                              <span className="text-gray-600 dark:text-gray-400 leading-relaxed text-xs">{act.desc}</span>
                                           </div>
                                        </div>
                                     </li>
                                  ))}
                               </ul>
                            </div>
                            <div className="pt-4 border-t border-gray-200/60 dark:border-slate-700/60">
                               <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Expected Outcome</p>
                               <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-100 dark:border-green-900">
                                 <p className="text-sm text-green-800 dark:text-green-400 font-medium flex items-start leading-tight">
                                    <CheckCircle className="w-4 h-4 mr-2 shrink-0 text-green-600 dark:text-green-500" />
                                    {guide.outcome}
                                 </p>
                               </div>
                            </div>
                         </div>
                      </div>
                   )
                })}
             </div>
          </aside>
        )}
      </div>

      {isPrismaModalOpen && (
         <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-lg w-full p-6">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white font-display">Edit PRISMA Counts</h3>
                  <button onClick={() => setIsPrismaModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                     <XCircle className="w-6 h-6" />
                  </button>
               </div>
               <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Manually adjust the counts for your PRISMA flowchart. This is useful if you have identified records through other methods or if you need to merge external screenings. Leave a field blank to use the automatically calculated value.
               </p>
               
               <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 styled-scrollbar">
                  {[
                     { key: 'identified', label: 'Records Identified', auto: state.totalIdentified },
                     { key: 'duplicates', label: 'Duplicates Removed', auto: state.totalDuplicates },
                     { key: 'screened', label: 'Records Screened (Title/Abstract)', auto: state.articles.length },
                     { key: 'titleAbstractExcluded', label: 'Records Excluded (Title/Abstract)', auto: excludedArticles.length },
                     { key: 'fullTextAssessed', label: 'Full-Text Articles Assessed', auto: includedArticles.length },
                     { key: 'fullTextExcluded', label: 'Full-Text Articles Excluded', auto: state.articles.filter(a => a.decision === 'included' && a.fullTextDecision === 'excluded').length },
                     { key: 'included', label: 'Studies Included', auto: fullyIncludedArticles.length }
                  ].map(({ key, label, auto }) => (
                     <div key={key} className="flex justify-between items-center">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-2/3">{label} (Auto: {auto})</label>
                        <input 
                           type="number"
                           className="w-1/3 bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 border rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-slate-400 focus:outline-none"
                           placeholder={String(auto)}
                           value={state.prismaOverrides[key as keyof typeof state.prismaOverrides] ?? ''}
                           onChange={(e) => {
                              const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                              setState(p => ({
                                 ...p,
                                 prismaOverrides: { ...p.prismaOverrides, [key]: val }
                              }));
                           }}
                        />
                     </div>
                  ))}
               </div>
               
               <div className="mt-8 flex justify-end space-x-3">
                  <button onClick={() => {
                     setState(p => ({ ...p, prismaOverrides: {} }));
                  }} className="px-5 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium">Reset to Auto</button>
                  <button onClick={() => setIsPrismaModalOpen(false)} className="bg-slate-900 dark:bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-indigo-700 transition">
                     Save & Close
                  </button>
               </div>
            </div>
         </div>
      )}

      {isExportPreviewOpen && (
         <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-6xl w-full p-6 flex flex-col max-h-[90vh]">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white font-display">Export Preview</h3>
                  <button onClick={() => setIsExportPreviewOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                     <XCircle className="w-6 h-6" />
                  </button>
               </div>
               <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  This table shows exactly what data will be included in the CSV, JSON, and PDF exports.
               </p>
               
               <div className="flex-1 overflow-auto border border-gray-200 dark:border-slate-700 rounded-lg">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider text-xs sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-4 py-3 border-b dark:border-slate-700 border-gray-200">PMID/ID</th>
                        <th className="px-4 py-3 border-b dark:border-slate-700 border-gray-200">Title</th>
                        <th className="px-4 py-3 border-b dark:border-slate-700 border-gray-200">QA Score</th>
                        {state.config.extractionFields.map((f, i) => (
                           <th key={i} className="px-4 py-3 border-b dark:border-slate-700 border-gray-200">{f}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {fullyIncludedArticles.map(a => (
                        <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-2 text-gray-900 dark:text-gray-200">{a.id}</td>
                          <td className="px-4 py-2 truncate max-w-[200px] text-gray-900 dark:text-gray-200" title={a.title}>{a.title}</td>
                          <td className="px-4 py-2 text-gray-900 dark:text-gray-200">{a.qualityAssessment?.score || 'Unassessed'}</td>
                          {state.config.extractionFields.map((f, i) => (
                            <td key={i} className="px-4 py-2 truncate max-w-[150px] text-gray-900 dark:text-gray-200" title={(a.customExtraction && a.customExtraction[f]) || ''}>
                               {(a.customExtraction && a.customExtraction[f]) || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {fullyIncludedArticles.length === 0 && (
                         <tr>
                           <td colSpan={3 + state.config.extractionFields.length} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                              No data available to export.
                           </td>
                         </tr>
                      )}
                    </tbody>
                  </table>
               </div>
               
               <div className="mt-6 flex justify-end">
                  <button onClick={() => setIsExportPreviewOpen(false)} className="bg-slate-900 dark:bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-indigo-700 transition">
                     Close Preview
                  </button>
               </div>
            </div>
         </div>
      )}

      {extractionModalArticleId && (
        <ExtractionModal
          article={state.articles.find(a => a.id === extractionModalArticleId)!}
          onSave={handleExtractionSave}
          onClose={() => setExtractionModalArticleId(null)}
          reviewType={state.config.reviewType}
        />
      )}
    </div>
  );
}
