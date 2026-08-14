import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSite } from '../context/SiteContext';

export const SiteSelector = ({ compact = false, onSelectSite, style }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { sites, selectedSiteId, setSelectedSiteId, selectedSite, fetchSites, loading, error } = useSite();

  const handleSelect = (item) => {
    setSelectedSiteId(item.id);
    if (onSelectSite) {
      onSelectSite(item);
    }
    setModalVisible(false);
  };

  const activeSiteName = selectedSite ? selectedSite.name : 'Select Site';
  const activeSiteLocation = selectedSite?.location || selectedSite?.code || null;

  const renderTrigger = () => {
    if (compact) {
      return (
        <TouchableOpacity
          style={[styles.compactTrigger, style]}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
          testID="site-selector-trigger-compact"
        >
          <MaterialCommunityIcons name="office-building" size={16} color="#006c49" />
          <Text style={styles.compactText} numberOfLines={1}>
            {activeSiteName}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={16} color="#64748B" />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.cardTrigger, style]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
        testID="site-selector-trigger-card"
      >
        <View style={styles.cardHeaderLeft}>
          <View style={styles.iconBadge}>
            <MaterialCommunityIcons name="office-building" size={22} color="#006c49" />
          </View>
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardSubLabel}>ACTIVE OPERATIONAL SITE</Text>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {activeSiteName}
            </Text>
            {activeSiteLocation && (
              <Text style={styles.cardLocation} numberOfLines={1}>
                {activeSiteLocation}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.cardChevronBadge}>
          <MaterialCommunityIcons name="chevron-down" size={20} color="#FFFFFF" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }) => {
    const isSelected = String(item.id) === String(selectedSiteId);
    return (
      <TouchableOpacity
        style={[styles.siteListItem, isSelected && styles.siteListItemSelected]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
        testID={`site-item-${item.id}`}
      >
        <View style={styles.itemInfo}>
          <Text style={[styles.itemTitle, isSelected && styles.itemTitleSelected]}>
            {item.name}
          </Text>
          {(item.location || item.code) && (
            <Text style={styles.itemSubtitle}>
              {item.location || item.code}
            </Text>
          )}
        </View>
        {isSelected && (
          <View style={styles.checkmarkBadge}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#006c49" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderModalContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#006c49" testID="site-selector-loading" />
          <Text style={styles.statusText}>Loading available sites...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={44} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchSites}
            activeOpacity={0.8}
            testID="site-selector-retry"
          >
            <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!sites || sites.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="office-building-off" size={44} color="#94A3B8" />
          <Text style={styles.emptyText}>No operational sites found.</Text>
          <TouchableOpacity
            style={[styles.retryButton, { marginTop: 12, backgroundColor: '#091426' }]}
            onPress={fetchSites}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={sites}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <>
      {renderTrigger()}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
        testID="site-selector-modal"
      >
        {/* Full-screen overlay — tap outside to close */}
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          {/* Inner card — stop tap propagation so it doesn't close */}
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalContainer}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.modalTitle}>Select Operational Site</Text>
                <Text style={styles.modalSubtitle}>
                  Filter metrics and operations by site location
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                testID="site-selector-close"
              >
                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Body */}
            <View style={styles.modalBody}>{renderModalContent()}</View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

export default SiteSelector;

const styles = StyleSheet.create({
  // Compact Trigger (Pill)
  compactTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  compactText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#091426',
    maxWidth: 130,
  },

  // Card Trigger (Default)
  cardTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#091426',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardSubLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#006c49',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  cardLocation: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
  cardChevronBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal Layout
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 60,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#091426',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  modalBody: {
    paddingTop: 12,
    minHeight: 180,
  },

  // List Items
  listContent: {
    paddingVertical: 4,
  },
  siteListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  siteListItemSelected: {
    backgroundColor: '#E6F4EA',
    borderColor: '#006c49',
  },
  itemInfo: {
    flex: 1,
    marginRight: 10,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#091426',
  },
  itemTitleSelected: {
    color: '#006c49',
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  checkmarkBadge: {
    marginLeft: 6,
  },

  // States
  centerContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#006c49',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});
