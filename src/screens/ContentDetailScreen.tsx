import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';

const ContentDetailScreen = ({route, navigation}: any) => {
  const content = route?.params?.content || {};

  const handleOpenUrl = () => {
    if (content.url) {
      Linking.openURL(content.url).catch(() =>
        Alert.alert('Error', 'Unable to open the link')
      );
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Thumbnail */}
      {content.thumbnail && (
        <Image source={{uri: content.thumbnail}} style={styles.thumbnail} />
      )}

      {/* Title */}
      <View style={styles.contentSection}>
        <Text style={styles.title}>{content.title || 'No Title'}</Text>
        
        {/* Content Type Badge */}
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {content.contentType === 'video' ? '🎥 Video' : '📸 Image'}
            </Text>
          </View>
        </View>

        {/* Description */}
        {content.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{content.description}</Text>
          </View>
        )}

        {/* AI Tags */}
        {content.aiTags && content.aiTags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Tags</Text>
            <View style={styles.tagsContainer}>
              {content.aiTags.map((tag: string, index: number) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Metadata */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          {content.savedAt && (
            <Text style={styles.metadata}>
              Saved: {formatDate(content.savedAt)}
            </Text>
          )}
          {content.viewCount !== undefined && (
            <Text style={styles.metadata}>
              Views: {content.viewCount.toLocaleString()}
            </Text>
          )}
        </View>

        {/* Original Link Button */}
        {content.url && (
          <TouchableOpacity style={styles.linkButton} onPress={handleOpenUrl}>
            <Text style={styles.linkButtonText}>🔗 Open Original</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  thumbnail: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  contentSection: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
    lineHeight: 30,
  },
  badgeContainer: {
    marginBottom: 20,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    backgroundColor: '#e3f2fd',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4a4a4a',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  metadata: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  linkButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  linkButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ContentDetailScreen;
