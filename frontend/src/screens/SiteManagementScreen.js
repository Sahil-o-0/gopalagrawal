import React, { useState, useContext } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, SafeAreaView, Alert, ScrollView
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import ErrorCard from '../components/ErrorCard';
import { API_BASE_URL } from '../config';

export default function SiteManagementScreen({ navigation }) {
  const { userToken, user } = useContext(AuthContext);
  const { sites, fetchSites, setSelectedSiteId, loading, error } = useSite();

  const [modalVisible, setModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', code: '' });
  const [formError, setFormError] = useState(null);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setFormError('Site name is required.');
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/sites/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          location: form.location.trim() || null,
          code: form.code.trim() || null,
          status: 'ACTIVE',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setModalVisible(false);
        setForm({ name: '', location: '', code: '' });
        await fetchSites();
        Alert.alert('Success', `Site "${data.name}" created successfully.`);
      } else {
        setFormError(data.detail || 'Failed to create site.');
      }
    } catch (e) {
      setFormError('Network error. Please check your connection.');
    } finally {
      setCreating(false);
    }
  };

  const handleSelect = async (siteId) => {
    await setSelectedSiteId(siteId);
    navigation.goBack();
  };

  const renderSite = ({ item }) => (
    <View style={styles.siteCard}>
      <View style={styles.siteCardLeft}>
        <Text style={styles.siteName}>{item.name}</Text>
        {item.code ? <Text style={styles.siteCode}>Code: {item.code}</Text> : null}
        {item.location ? <Text style={styles.siteLoc}>📍 {item.location}</Text> : null}
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'ACTIVE' ? '#D1FAE5' : '#FEE2E2' }]}>
          <Text style={[styles.statusText, { color: item.status === 'ACTIVE' ? '#065F46' : '#991B1B' }]}>
            {item.status}
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.selectBtn} onPress={() => handleSelect(item.id)} activeOpacity={0.8}>
        <Text style={styles.selectBtnText}>Select</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Site Management</Text>
        {user?.role === 'ADMIN' || user?.role === 'MANAGER' ? (
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 60 }} />}
      </View>

      {/* Error */}
      {error && (
        <ErrorCard title="Failed to load sites" message={error} onRetry={fetchSites} />
      )}

      {/* Loading */}
      {loading && !error && (
        <ActivityIndicator color="#3B82F6" style={{ marginTop: 40 }} />
      )}

      {/* Sites List */}
      {!loading && !error && (
        <FlatList
          data={sites}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderSite}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🏗️</Text>
              <Text style={styles.emptyTitle}>No sites found</Text>
              <Text style={styles.emptyMsg}>
                {user?.role === 'ADMIN' || user?.role === 'MANAGER'
                  ? 'Tap "+ New" to add your first site.'
                  : 'No sites have been created yet.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Create Site Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Site</Text>

            {formError && (
              <ErrorCard title="Validation Error" message={formError} />
            )}

            <Text style={styles.inputLabel}>Site Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Pune Warehouse"
              value={form.name}
              onChangeText={(v) => setForm(f => ({ ...f, name: v }))}
              autoCapitalize="words"
            />

            <Text style={styles.inputLabel}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Pune, Maharashtra"
              value={form.location}
              onChangeText={(v) => setForm(f => ({ ...f, location: v }))}
            />

            <Text style={styles.inputLabel}>Site Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. PNW-01"
              value={form.code}
              onChangeText={(v) => setForm(f => ({ ...f, code: v.toUpperCase() }))}
              autoCapitalize="characters"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setModalVisible(false); setFormError(null); setForm({ name: '', location: '', code: '' }); }}
                disabled={creating}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={creating} activeOpacity={0.8}>
                {creating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.createBtnText}>Create Site</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 4 },
  backText: { color: '#3B82F6', fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  addBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  listContent: { padding: 16, gap: 12 },
  siteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  siteCardLeft: { flex: 1, marginRight: 12 },
  siteName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  siteCode: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  siteLoc: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 8,
  },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  selectBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  selectBtnText: { color: '#1D4ED8', fontWeight: '700', fontSize: 13 },
  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginBottom: 8 },
  emptyMsg: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', maxWidth: 260 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
    color: '#111827',
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center',
  },
  cancelBtnText: { color: '#374151', fontWeight: '700', fontSize: 15 },
  createBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 10,
    backgroundColor: '#3B82F6', alignItems: 'center',
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
