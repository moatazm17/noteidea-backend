export interface IContent {
  _id: string;
  deviceId: string;
  url: string;
  title: string;
  contentType: 'video' | 'image' | 'other';
  aiTags: string[];
  description: string;
  thumbnail?: string;
  viewCount?: number;
  isFavorite: boolean;
  savedAt: string;
}

// Keep legacy export for backward compatibility
export type Content = IContent;

export interface ContentResponse {
  success: boolean;
  data: {
    videos: Content[];
    screenshots: Content[];
    recent: Content[];
  };
  total: number;
}

export interface SearchResponse {
  success: boolean;
  data: Content[];
  query: string;
  total: number;
}

export interface SaveRequest {
  deviceId: string;
  url: string;
  contentType: 'video' | 'image' | 'other';
}
