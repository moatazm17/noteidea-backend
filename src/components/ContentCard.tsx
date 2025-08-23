import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Content } from '../types/Content';

interface ContentCardProps {
  content: Content;
  width: number;
  onPress: () => void;
}

const ContentCard: React.FC<ContentCardProps> = ({ content, width, onPress }) => {
  const getIcon = () => {
    switch (content.contentType) {
      case 'video':
        return '🎥';
      case 'image':
        return '📸';
      default:
        return '🔗';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return '1 day ago';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, { width }]}
      onPress={() => {
        console.log('🎯 ContentCard onPress called with:', content.title);
        onPress();
      }}
      activeOpacity={0.8}
    >
      {/* Thumbnail or Placeholder */}
      <View style={styles.thumbnailContainer}>
        {content.thumbnail ? (
          <Image
            source={{ uri: content.thumbnail }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderThumbnail}>
            <Text style={styles.placeholderIcon}>{getIcon()}</Text>
          </View>
        )}
        
        {/* Content Type Badge */}
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{getIcon()}</Text>
        </View>
      </View>

      {/* Content Info */}
      <View style={styles.contentInfo}>
        <Text style={styles.title} numberOfLines={2}>
          {content.title}
        </Text>
        
        {/* Tags */}
        {content.aiTags && content.aiTags.length > 0 && (
          <View style={styles.tagsContainer}>
            {content.aiTags.slice(0, 2).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {content.aiTags.length > 2 && (
              <Text style={styles.moreTagsText}>+{content.aiTags.length - 2}</Text>
            )}
          </View>
        )}
        
        {/* Date */}
        <Text style={styles.date}>{formatDate(content.savedAt)}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 8,
  },
  thumbnailContainer: {
    position: 'relative',
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 32,
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeText: {
    fontSize: 12,
  },
  contentInfo: {
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    lineHeight: 18,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    alignItems: 'center',
  },
  tag: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 2,
  },
  tagText: {
    fontSize: 10,
    color: '#1976d2',
    fontWeight: '500',
  },
  moreTagsText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  date: {
    fontSize: 11,
    color: '#999',
  },
});

export default ContentCard;
