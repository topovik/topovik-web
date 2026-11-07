export type StrapiMediaFormat = {
  url: string;
  width?: number;
  height?: number;
};

export type StrapiMedia = {
  id?: number;
  url: string;
  alternativeText?: string | null;
  width?: number;
  height?: number;
  formats?: {
    medium?: StrapiMediaFormat | null;
    thumbnail?: StrapiMediaFormat | null;
  } | null;
  /** Strapi stores LQIP in provider_metadata.placeholder */
  provider_metadata?: {
    placeholder?: string | null;
  } | null;
};

export type Category = {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description?: string | null;
};

export type Tag = {
  id: number;
  documentId: string;
  name: string;
  slug: string;
};

export type Seo = {
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalPath?: string | null;
};

export type Article = {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  content?: string;
  readingMinutes?: number | null;
  views?: number;
  likes?: number;
  dislikes?: number;
  legacyPath?: string | null;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string | null;
  category?: Category | null;
  tags?: Tag[];
  cover?: StrapiMedia | null;
  seo?: Seo | null;
};

export type Page = {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  content?: string;
  seo?: Seo | null;
};

export type Comment = {
  id: number;
  documentId: string;
  content: string;
  authorName: string;
  approved: boolean;
  createdAt?: string;
};

export type StrapiListResponse<T> = {
  data: T[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
};

export type StrapiItemResponse<T> = {
  data: T;
};
