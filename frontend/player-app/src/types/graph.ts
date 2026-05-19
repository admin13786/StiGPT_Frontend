export type GraphSearchType = 'all' | 'paper' | 'author' | 'institution' | 'topic';

export type GraphEntityType = Exclude<GraphSearchType, 'all'>;

export interface GraphCountSummary {
  authors?: number;
  citing?: number;
  citedBy?: number;
  topics?: number;
  papers?: number;
  institutions?: number;
  collaborationsFrom?: number;
  collaborationsTo?: number;
}

export interface GraphPaperSearchItem {
  id: string;
  title: string;
  year?: number | null;
  venue?: string | null;
  discipline?: string | null;
  subField?: string | null;
  citationCount?: number;
  createdAt?: string;
  _count?: GraphCountSummary;
}

export interface GraphAuthorSearchItem {
  id: string;
  name: string;
  affiliation?: string | null;
  hIndex?: number | null;
  createdAt?: string;
  _count?: GraphCountSummary;
}

export interface GraphInstitutionSearchItem {
  id: string;
  name: string;
  nameEn?: string | null;
  country?: string | null;
  city?: string | null;
  updatedAt?: string;
  _count?: GraphCountSummary;
}

export interface GraphTopicSearchItem {
  id: string;
  name: string;
  normalizedName: string;
  updatedAt?: string;
  _count?: GraphCountSummary;
}

export interface GraphAllSearchResults {
  papers: GraphPaperSearchItem[];
  authors: GraphAuthorSearchItem[];
  institutions: GraphInstitutionSearchItem[];
  topics: GraphTopicSearchItem[];
}

export interface GraphAllSearchTotals {
  papers: number;
  authors: number;
  institutions: number;
  topics: number;
}

export interface GraphAllSearchResponse {
  query?: string;
  type: 'all';
  pageNo: number;
  pageSize: number;
  totals: GraphAllSearchTotals;
  results: GraphAllSearchResults;
}

export interface GraphTypedSearchResponse<TItem> {
  query?: string;
  type: GraphEntityType;
  pageNo: number;
  pageSize: number;
  total: number;
  items: TItem[];
}

export type GraphSearchResponse =
  | GraphAllSearchResponse
  | GraphTypedSearchResponse<GraphPaperSearchItem | GraphAuthorSearchItem | GraphInstitutionSearchItem | GraphTopicSearchItem>;

export interface GraphSearchQuery {
  q?: string;
  type?: GraphSearchType;
  pageNo?: number;
  pageSize?: number;
}

export interface GraphPaperAuthor {
  id: string;
  name: string;
  affiliation?: string | null;
  email?: string | null;
  hIndex?: number | null;
  order?: number;
  institutions?: Array<{
    id: string;
    name: string;
    country?: string | null;
    city?: string | null;
    isPrimary?: boolean;
    startYear?: number | null;
    endYear?: number | null;
  }>;
}

export interface GraphTopicRelation {
  id: string;
  name: string;
  normalizedName?: string;
  weight?: number;
}

export interface GraphPaperDetail {
  id: string;
  title: string;
  abstract?: string | null;
  year?: number | null;
  venue?: string | null;
  discipline?: string | null;
  subField?: string | null;
  language?: string | null;
  status?: string;
  citationCount?: number;
  createdAt?: string;
  updatedAt?: string;
  authors: GraphPaperAuthor[];
  topics: GraphTopicRelation[];
  _count?: GraphCountSummary;
}

export interface GraphPaperRelations {
  paper: {
    id: string;
    title: string;
    year?: number | null;
    venue?: string | null;
    discipline?: string | null;
    subField?: string | null;
  };
  authors: Array<{
    id: string;
    name: string;
    affiliation?: string | null;
    order?: number;
  }>;
  topics: GraphTopicRelation[];
  references: GraphPaperSearchItem[];
  citedBy: GraphPaperSearchItem[];
}

export interface GraphCollaborator {
  id: string;
  name: string;
  affiliation?: string | null;
  paperCount: number;
  lastYear?: number | null;
}

export interface GraphAuthorDetail {
  id: string;
  name: string;
  affiliation?: string | null;
  email?: string | null;
  hIndex?: number | null;
  createdAt?: string;
  stats: {
    paperCount: number;
    institutionCount: number;
    collaborationCount: number;
  };
  institutions: Array<{
    id: string;
    name: string;
    country?: string | null;
    city?: string | null;
    isPrimary?: boolean;
    startYear?: number | null;
    endYear?: number | null;
  }>;
  papers: Array<GraphPaperSearchItem & { authorOrder?: number }>;
  topCollaborators: GraphCollaborator[];
}

export interface GraphInstitutionDetail {
  id: string;
  name: string;
  normalizedName: string;
  nameEn?: string | null;
  country?: string | null;
  city?: string | null;
  createdAt?: string;
  updatedAt?: string;
  stats: {
    authorCount: number;
  };
  topAuthors: Array<{
    id: string;
    name: string;
    affiliation?: string | null;
    paperCount: number;
    isPrimary?: boolean;
    startYear?: number | null;
    endYear?: number | null;
  }>;
}

