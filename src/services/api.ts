import axios from 'axios';
import { Content, ContentResponse, SearchResponse, SaveRequest } from '../types/Content';

const API_BASE_URL = 'https://noteidea-backend-production.up.railway.app/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  // Get all content for a device
  async getContent(deviceId: string): Promise<ContentResponse> {
    const response = await api.get(`/content/${deviceId}`);
    return response.data;
  },

  // Save new content
  async saveContent(request: SaveRequest): Promise<{ success: boolean; data: Content; message: string }> {
    const response = await api.post('/save', request);
    return response.data;
  },

  // Search content
  async searchContent(deviceId: string, query: string, type?: string): Promise<SearchResponse> {
    const params = new URLSearchParams({ query });
    if (type) params.append('type', type);
    
    const response = await api.get(`/search/${deviceId}?${params}`);
    return response.data;
  },

  // Get single content item
  async getContentItem(deviceId: string, contentId: string): Promise<{ success: boolean; data: Content }> {
    const response = await api.get(`/content/${deviceId}/${contentId}`);
    return response.data;
  },

  // Delete content
  async deleteContent(deviceId: string, contentId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/content/${deviceId}/${contentId}`);
    return response.data;
  },
};
