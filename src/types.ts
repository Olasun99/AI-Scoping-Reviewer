export interface ProjectConfig {
  title: string;
  reviewType: 'Scoping Review';
  startYear: string;
  endYear: string;
  population: string;
  interventions: string;
  outcomes: string;
  frameworkType: 'PICO' | 'PCC' | 'Custom';
  pico: { p: string, i: string, c: string, o: string };
  pcc: { p: string, c: string, c2: string }; // c2 = Context
  inclusionCriteria: string;
  exclusionCriteria: string;
  extractionFields: string[];
  reviewerName?: string;
  affiliation?: string;
  dateOfSearch?: string;
}

export interface SearchStrategy {
  populationTerms: string;
  conceptTerms: string;
  riskFactorTerms: string;
  builtQuery: string;
}

export interface QualityAssessment {
  design: 'Randomised' | 'Non-randomised' | 'Observational' | 'Other' | '';
  checklist: Record<string, boolean | 'Unclear' | 'Not Applicable'>;
  score: 'Low Risk' | 'Moderate Risk' | 'High Risk' | 'Unassessed';
}

export interface BibliographicInfo {
  pmcid?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  country?: string;
  institution?: string;
  funding?: string;
  conflictsOfInterest?: string;
}

export interface StudyCharacteristics {
  population?: string;
  age?: string;
  sex?: string;
  inclusionCriteria?: string;
  exclusionCriteria?: string;
  followUpPeriod?: string;
  setting?: string;
  randomization?: string;
  blinding?: string;
}

export interface InterventionDetails {
  intervention?: string;
  comparator?: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  route?: string;
  treatmentProtocol?: string;
}

export interface AdvancedOutcome {
  id: string;
  outcomeName: string;
  outcomeType: 'Binary' | 'Continuous' | 'Time-to-event' | '';
  nIntervention?: string;
  nComparator?: string;
  // Continuous
  meanIntervention?: string;
  sdIntervention?: string;
  meanComparator?: string;
  sdComparator?: string;
  // Binary
  eventsIntervention?: string;
  eventsComparator?: string;
  // General / Calculated
  effectMeasure?: 'OR' | 'RR' | 'HR' | 'MD' | 'SMD' | 'Other' | '';
  effectSize?: string;
  lowerCI?: string;
  upperCI?: string;
  pValue?: string;
}

export interface MetaAnalysisData {
  effectSize: string;
  lowerCI: string;
  upperCI: string;
  weight: string;
  // Allow advanced outcomes to be stored as well
  outcomes?: AdvancedOutcome[];
}

export interface Article {
  id: string; // pmid or openalex id
  title: string;
  abstract: string;
  authors: string;
  year: string;
  journal: string;
  url: string;
  doi?: string;
  decision: 'pending' | 'included' | 'excluded';
  exclusionReason?: string;
  fullTextDecision: 'pending' | 'included' | 'excluded';
  fullTextExclusionReason?: string;
  
  // Advanced extraction blocks
  bibliographic?: BibliographicInfo;
  studyCharacteristics?: StudyCharacteristics;
  interventionDetails?: InterventionDetails;

  // Basic extraction fields (legacy)
  studyDesign?: string;
  sampleSize?: string;
  lesionType?: string;
  riskFactors?: string;
  keyFindings?: string;
  riskOfBias?: 'Low' | 'Moderate' | 'High' | '';
  customExtraction?: Record<string, string>;
  qualityAssessment?: QualityAssessment;
  metaAnalysisData?: MetaAnalysisData;
}

export interface RecentSearch {
  id: string;
  query: string;
  date: string;
}

export interface PRISMAOverrides {
  identified?: number;
  duplicates?: number;
  screened?: number;
  titleAbstractExcluded?: number;
  fullTextAssessed?: number;
  fullTextExcluded?: number;
  included?: number;
}

export interface GradeAssessment {
  id: string;
  outcome: string;
  riskOfBias: 'Not Serious' | 'Serious' | 'Very Serious' | '';
  inconsistency: 'Not Serious' | 'Serious' | 'Very Serious' | '';
  indirectness: 'Not Serious' | 'Serious' | 'Very Serious' | '';
  imprecision: 'Not Serious' | 'Serious' | 'Very Serious' | '';
  publicationBias: 'Not Serious' | 'Serious' | 'Very Serious' | '';
  certainty: 'High' | 'Moderate' | 'Low' | 'Very Low' | '';
  importance: 'Critical' | 'Important' | 'Not Important' | '';
}

export interface AppState {
  config: ProjectConfig;
  strategy: SearchStrategy;
  articles: Article[];
  isSearching: boolean;
  isAutoScreening: boolean;
  totalIdentified: number;
  totalDuplicates: number;
  searchProgress: string;
  prismaOverrides: PRISMAOverrides;
  gradeAssessments: GradeAssessment[];
}
