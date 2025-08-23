import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { apiService } from '../services/api';
import { getDeviceId } from '../utils/deviceId';

const SaveScreen = ({ navigation }: any) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const detectContentType = (url: string): 'tiktok' | 'screenshot' | 'other' => {
    if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) {
      return 'tiktok';
    }
    if (url.includes('.jpg') || url.includes('.png') || url.includes('.jpeg') || url.includes('.gif')) {
      return 'screenshot';
    }
    return 'other';
  };

  const handleSave = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a URL or paste a link');
      return;
    }

    setLoading(true);
    
    try {
      const deviceId = await getDeviceId();
      const contentType = detectContentType(url.trim());
      
      const response = await apiService.saveContent({
        deviceId,
        url: url.trim(),
        contentType,
      });

      if (response.success) {
        Alert.alert(
          'Success!',
          'Content saved successfully!',
          [
            {
              text: 'Save Another',
              onPress: () => setUrl(''),
            },
            {
              text: 'View Content',
              onPress: () => navigation.navigate('Home'),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error saving content:', error);
      Alert.alert(
        'Error',
        'Failed to save content. Please check your internet connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePasteExample = (exampleUrl: string) => {
    setUrl(exampleUrl);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Save Content</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <Text style={styles.title}>Save anything to find it later</Text>
        <Text style={styles.subtitle}>
          Paste a TikTok link, image URL, or any content you want to save
        </Text>

        {/* URL Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.urlInput}
            placeholder="Paste link here..."
            value={url}
            onChangeText={setUrl}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            textAlignVertical="top"
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.quickActionsTitle}>Quick Actions:</Text>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handlePasteExample('https://www.tiktok.com/@example/video/123456')}
          >
            <Text style={styles.actionIcon}>📱</Text>
            <Text style={styles.actionText}>Paste TikTok Link</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handlePasteExample('https://example.com/image.jpg')}
          >
            <Text style={styles.actionIcon}>📸</Text>
            <Text style={styles.actionText}>Paste Image URL</Text>
          </TouchableOpacity>
        </View>

        {/* Examples */}
        <View style={styles.examplesContainer}>
          <Text style={styles.examplesTitle}>Supported content:</Text>
          <Text style={styles.exampleItem}>• TikTok videos</Text>
          <Text style={styles.exampleItem}>• Screenshots & images</Text>
          <Text style={styles.exampleItem}>• Web links</Text>
          <Text style={styles.exampleItem}>• Social media posts</Text>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading || !url.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Content</Text>
          )}
        </TouchableOpacity>

        {/* AI Info */}
        <View style={styles.aiInfoContainer}>
          <Text style={styles.aiInfoTitle}>✨ AI will automatically:</Text>
          <Text style={styles.aiInfoItem}>• Analyze and tag your content</Text>
          <Text style={styles.aiInfoItem}>• Make it searchable with keywords</Text>
          <Text style={styles.aiInfoItem}>• Organize it for easy finding</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 24,
  },
  urlInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  quickActions: {
    marginBottom: 24,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  actionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  actionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  examplesContainer: {
    marginBottom: 32,
  },
  examplesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  exampleItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  aiInfoContainer: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  aiInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0369a1',
    marginBottom: 8,
  },
  aiInfoItem: {
    fontSize: 14,
    color: '#0369a1',
    marginBottom: 4,
  },
});

export default SaveScreen;
