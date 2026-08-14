import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Alert, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { API_BASE_URL } from '../config';

export default function UserLedgerScreen({ route, navigation }) {
  const { user, userToken, dailyLedgerEntries } = route.params;

  const [staffLedgerEntries, setStaffLedgerEntries] = useState([]);
  const [isAddLedgerModalVisible, setIsAddLedgerModalVisible] = useState(false);
  const [newLedgerAmount, setNewLedgerAmount] = useState('');
  const [newLedgerDescription, setNewLedgerDescription] = useState('');
  const [newLedgerType, setNewLedgerType] = useState('SALARY');

  const fetchStaffLedger = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/workforce/staff-ledger/${user.id}`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      if (resp.ok) setStaffLedgerEntries(await resp.json());
    } catch (e) { console.error("Error fetching ledger", e); }
  };

  useEffect(() => {
    fetchStaffLedger();
  }, []);

  const createLedgerEntry = async () => {
    if (!newLedgerAmount) return;
    try {
      const resp = await fetch(`${API_BASE_URL}/workforce/staff-ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({
          staff_id: user.id,
          amount: parseFloat(newLedgerAmount) * (newLedgerType === 'ADVANCE' ? -1 : 1),
          transaction_type: newLedgerType,
          description: newLedgerDescription
        })
      });
      if (resp.ok) {
        setNewLedgerAmount('');
        setNewLedgerDescription('');
        fetchStaffLedger();
        setIsAddLedgerModalVisible(false);
      }
    } catch (e) { Alert.alert("Error creating ledger entry"); }
  };

  const deleteUser = (uid) => {
    Alert.alert(
      "Delete User?",
      "Are you sure you want to permanently remove this user?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
          try {
            const resp = await fetch(`${API_BASE_URL}/auth/users/${uid}`, { 
              method: 'DELETE', headers: { 'Authorization': `Bearer ${userToken}` }
            });
            if (resp.ok) {
              Alert.alert("Success", "User deleted");
              navigation.goBack();
            }
          } catch (e) { Alert.alert("Error deleting user"); }
        }}
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="arrow-left" size={28} color="#1E293B" />
            <View style={{ marginLeft: 6 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B' }}>{user.full_name || user.username}'s Ledger</Text>
              <Text style={{ fontSize: 11, color: '#6B7280' }}>Salary & advances for @{user.username}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Total Advance Summary */}
        <View style={[styles.emiMetricCard, { borderColor: '#EF4444', marginBottom: 20, padding: 12, flex: 0 }]}>
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                    <Text style={styles.emiMetricLabel}>TOTAL ADVANCE OUTSTANDING</Text>
                    <Text style={[styles.emiMetricValue, { color: '#B91C1C' }]}>₹{Math.abs(staffLedgerEntries.filter(e => e.transaction_type === "ADVANCE").reduce((acc, curr) => acc + curr.amount, 0)).toLocaleString()}</Text>
                </View>
                <TouchableOpacity 
                    style={[styles.emiMarkPaidBtn, { backgroundColor: '#EF4444', paddingVertical: 8 }]} 
                    onPress={() => {
                        const totalAdv = Math.abs(staffLedgerEntries.filter(e => e.transaction_type === "ADVANCE").reduce((acc, curr) => acc + curr.amount, 0));
                        if (totalAdv <= 0) return Alert.alert("No outstanding advance");
                        setNewLedgerAmount(totalAdv.toString());
                        setNewLedgerType('PAYMENT');
                        setNewLedgerDescription('Bulk Advance Clearance');
                        setIsAddLedgerModalVisible(true);
                    }}
                >
                    <Text style={styles.emiMarkPaidText}>Clear All</Text>
                </TouchableOpacity>
             </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
           <TouchableOpacity style={[styles.emiAddBtn, { flex: 1, backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center' }]} onPress={() => {
              setNewLedgerAmount('');
              setNewLedgerDescription('');
              setNewLedgerType('SALARY');
              setIsAddLedgerModalVisible(true);
           }}>
              <Text style={styles.emiAddBtnText}>+ Add Entry</Text>
           </TouchableOpacity>
           <TouchableOpacity style={[styles.emiAddBtn, { flex: 1, justifyContent: 'center', alignItems: 'center' }]} onPress={() => {
             navigation.navigate('UserProfile', { userProfile: user, userToken, dailyLedgerEntries, sites: route.params.sites });
           }}><Text style={styles.emiAddBtnText}>✏️ Edit Profile</Text></TouchableOpacity>
           <TouchableOpacity style={[styles.emiAddBtn, { backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' }]} onPress={() => deleteUser(user.id)}><Text style={styles.emiAddBtnText}><MaterialCommunityIcons name="trash-can-outline" size={16} /></Text></TouchableOpacity>
        </View>

        <FlatList
          data={staffLedgerEntries}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.ledgerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ledgerDate}>
                  {(() => {
                    const d = new Date(item.date);
                    const dd = String(d.getDate()).padStart(2, '0');
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const yyyy = d.getFullYear();
                    return `${dd}-${mm}-${yyyy}`;
                  })()}
                </Text>
                <Text style={styles.ledgerType}>{item.transaction_type}</Text>
                {item.description && <Text style={styles.ledgerDesc}>{item.description}</Text>}
              </View>
              <View><Text style={[styles.ledgerAmount, { color: item.amount < 0 ? '#DC2626' : '#059669' }]}>{item.amount < 0 ? '-' : '+'}₹{Math.abs(item.amount).toLocaleString()}</Text></View>
            </View>
          )}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>No transaction records yet.</Text>}
        />
      </View>

      {/* Manual Entry Modal (Simple popup inside this full screen) */}
      {isAddLedgerModalVisible && (
        <View style={styles.overlayContainer}>
          <View style={styles.overlayContent}>
            <Text style={styles.modalTitle}>Manual Entry</Text>
            <TextInput style={styles.input} placeholder="Amount" keyboardType="numeric" value={newLedgerAmount} onChangeText={setNewLedgerAmount} />
            <TextInput style={styles.input} placeholder="Description (Optional)" value={newLedgerDescription} onChangeText={setNewLedgerDescription} />
            
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                <TouchableOpacity onPress={() => setNewLedgerType('SALARY')} style={[styles.roleBtn, { flex: 1 }, newLedgerType === 'SALARY' && styles.roleBtnActive]}><Text style={newLedgerType === 'SALARY' ? styles.roleTextActive : styles.roleText} numberOfLines={1}>Salary</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setNewLedgerType('PAYMENT')} style={[styles.roleBtn, { flex: 1 }, newLedgerType === 'PAYMENT' && styles.roleBtnActive]}><Text style={newLedgerType === 'PAYMENT' ? styles.roleTextActive : styles.roleText} numberOfLines={1}>Adjustment</Text></TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.confirmBtn} onPress={createLedgerEntry}><Text style={styles.confirmBtnText}>Add Record</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddLedgerModalVisible(false)}><Text style={styles.cancelBtnText}>Back</Text></TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  emiMetricCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, borderLeftWidth: 4, elevation: 2 },
  emiMetricLabel: { fontSize: 9, fontWeight: '800', color: '#6B7280', marginBottom: 4 },
  emiMetricValue: { fontSize: 22, fontWeight: '900', color: '#111827' },
  emiMarkPaidBtn: { backgroundColor: '#059669', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  emiMarkPaidText: { color: 'white', fontWeight: '800', fontSize: 13 },
  emiAddBtn: { backgroundColor: '#111827', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  emiAddBtnText: { color: 'white', fontWeight: 'bold' },
  ledgerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  ledgerDate: { fontSize: 13, fontWeight: '700', color: '#111827' },
  ledgerType: { fontSize: 10, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', marginTop: 2 },
  ledgerDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  ledgerAmount: { fontSize: 16, fontWeight: '800' },
  overlayContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 99 },
  overlayContent: { width: '90%', backgroundColor: 'white', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  input: { backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12, marginBottom: 10, color: '#111827' },
  confirmBtn: { backgroundColor: '#2563EB', padding: 12, borderRadius: 8, alignItems: 'center' },
  confirmBtnText: { color: 'white', fontWeight: 'bold' },
  cancelBtn: { backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  cancelBtnText: { color: '#4B5563', fontWeight: 'bold' },
  roleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  roleBtnActive: { backgroundColor: '#1E293B' },
  roleText: { color: '#6B7280', fontWeight: '800', fontSize: 13 },
  roleTextActive: { color: 'white', fontWeight: '800', fontSize: 13 }
});
