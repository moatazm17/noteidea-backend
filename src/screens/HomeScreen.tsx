import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiService } from '../services/api';
import { getDeviceId } from '../utils/deviceId';
import { Content } from '../types/Content';
import ContentCard from '../components/ContentCard';

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;

const HomeScreen = ({ navigation }: any) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [content, setContent] = useState<{
    videos: Content[];
    screenshots: Content[];
    recent: Content[];
  }>({
    videos: [],
    screenshots: [],
    recent: []
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'videos' | 'screenshots'>('all');

  const loadContent = async () => {
    try {
      const deviceId = await getDeviceId();
      const response = await apiService.getContent(deviceId);
      
      if (response.success) {
        setContent(response.data);
      }
    } catch (error) {
      console.error('Error loading content:', error);
      Alert.alert('Error', 'Failed to load content');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const deviceId = await getDeviceId();
      navigation.navigate('Search', { 
        query: searchQuery,
        deviceId 
      });
    } catch (error) {
      console.error('Error searching:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadContent();
  };

  const getFilteredContent = () => {
    switch (activeFilter) {
      case 'videos':
        return content.videos;
      case 'screenshots':
        return content.screenshots;
      default:
        return [...content.videos, ...content.screenshots].sort(
          (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        );
    }
  };

  const handleContentPress = (item) => {
    console.log('🎉 NAVIGATING TO CONTENT DETAIL! Opening content:', item.title);
    navigation.navigate('ContentDetail', { content: item });
  };

  useFocusEffect(
    useCallback(() => {
      loadContent();
    }, [])
  );

  const renderContentGrid = () => {
    const filteredContent = getFilteredContent();
    
    if (filteredContent.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No content yet</Text>
          <Text style={styles.emptySubtitle}>
            Start saving TikToks and screenshots to see them here!
          </Text>
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={() => navigation.navigate('Save')}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={filteredContent}
        numColumns={2}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => (
          <ContentCard
            content={item}
            width={cardWidth}
            onPress={() => handleContentPress(item)}
          />
        )}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading your content...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kova</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={() => navigation.navigate('Save')}
        >
          <Text style={styles.saveButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search your saved content..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
      </View>

      <View style={styles.filtersContainer}>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'all' && styles.activeFilter]}
          onPress={() => setActiveFilter('all')}
        >
          <Text style={[styles.filterText, activeFilter === 'all' && styles.activeFilterText]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'videos' && styles.activeFilter]}
          onPress={() => setActiveFilter('videos')}
        >
          <Text style={[styles.filterText, activeFilter === 'videos' && styles.activeFilterText]}>
            Videos ({content.videos.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'screenshots' && styles.activeFilter]}
          onPress={() => setActiveFilter('screenshots')}
        >
          <Text style={[styles.filterText, activeFilter === 'screenshots' && styles.activeFilterText]}>
            Screenshots ({content.screenshots.length})
          </Text>
        </TouchableOpacity>
      </View>

      {renderContentGrid()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  saveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  activeFilter: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#fff',
  },
  gridContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  getStartedButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  getStartedText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
});

export default HomeScreen;
