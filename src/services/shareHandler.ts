import ReceiveSharingIntent from 'react-native-receive-sharing-intent';
import { apiService } from './api';
import { getDeviceId } from '../utils/deviceId';

export interface SharedContent {
  url?: string;
  text?: string;
  type: 'url' | 'text';
}

class ShareHandlerService {
  private listeners: Array<(content: SharedContent) => void> = [];

  /**
   * Initialize share handling when app starts
   */
  initialize() {
    // Handle URLs shared to the app
    ReceiveSharingIntent.getReceivedFiles(
      (files: any[]) => {
        console.log('📱 Received shared files:', files);
        
        files.forEach(file => {
          if (file.weblink || file.contentUri) {
            const url = file.weblink || file.contentUri;
            this.handleSharedContent({ url, type: 'url' });
          }
        });
      },
      (error: any) => {
        console.error('❌ Error receiving shared files:', error);
      }
    );

    // Handle text shared to the app
    ReceiveSharingIntent.getReceivedText(
      (text: string) => {
        console.log('📱 Received shared text:', text);
        
        if (text) {
          // Check if text contains a URL
          const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
          if (urlMatch) {
            this.handleSharedContent({ url: urlMatch[0], type: 'url' });
          } else {
            this.handleSharedContent({ text, type: 'text' });
          }
        }
      },
      (error: any) => {
        console.error('❌ Error receiving shared text:', error);
      }
    );

    console.log('✅ Share handler initialized');
  }

  /**
   * Handle shared content from other apps
   */
  private handleSharedContent(content: SharedContent) {
    console.log('🎯 Processing shared content:', content);
    
    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(content);
      } catch (error) {
        console.error('❌ Error in share listener:', error);
      }
    });
  }

  /**
   * Add a listener for shared content
   */
  addListener(callback: (content: SharedContent) => void) {
    this.listeners.push(callback);
    
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Auto-save shared URL content
   */
  async autoSaveSharedUrl(url: string): Promise<boolean> {
    try {
      console.log('💾 Auto-saving shared URL:', url);
      
      const deviceId = await getDeviceId();
      
      const response = await apiService.saveContent({
        deviceId,
        url,
        contentType: this.detectContentType(url)
      });

      if (response.success) {
        console.log('✅ Auto-save successful:', response.message);
        return true;
      } else {
        console.error('❌ Auto-save failed:', response);
        return false;
      }
    } catch (error) {
      console.error('❌ Auto-save error:', error);
      return false;
    }
  }

  /**
   * Detect content type from URL
   */
  private detectContentType(url: string): 'video' | 'image' | 'other' {
    try {
      const urlObj = new URL(url);
      
      // Video platforms
      if (urlObj.hostname.includes('tiktok.com') || 
          urlObj.hostname.includes('youtube.com') || 
          urlObj.hostname.includes('youtu.be') ||
          urlObj.hostname.includes('instagram.com')) {
        return 'video';
      }
      
      // Image files
      if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        return 'image';
      }
      
      return 'other';
    } catch (error) {
      return 'other';
    }
  }

  /**
   * Clear any pending shared content
   */
  clearSharedContent() {
    ReceiveSharingIntent.clearReceivedFiles();
  }
}

export const shareHandler = new ShareHandlerService();
