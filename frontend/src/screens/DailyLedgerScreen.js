import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, TextInput, ScrollView, ActivityIndicator, Modal, StatusBar, Platform, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AuthContext } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

export default function DailyLedgerScreen({ navigation }) {
    const { userToken } = useContext(AuthContext);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [ledgerData, setLedgerData] = useState([]);
    
    // Filter State
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [filterMode, setFilterMode] = useState('MONTH'); // DAY, MONTH

    // Manual Entry State
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [entryType, setEntryType] = useState('EXPENSE'); // INCOME, EXPENSE
    const [category, setCategory] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        fetchLedger();
    }, [selectedDate, filterMode]);

    const fetchLedger = async () => {
        setIsLoading(true);
        try {
            let url = `${API_BASE_URL}/workforce/daily-ledger?`;
            if (filterMode === 'DAY') {
                url += `date=${selectedDate.toISOString().split('T')[0]}`;
            } else {
                url += `month=${selectedDate.getMonth() + 1}&year=${selectedDate.getFullYear()}`;
            }

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${userToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                setLedgerData(data);
            }
        } catch (error) {
            Alert.alert("Error", "Failed to fetch ledger data");
        }
        setIsLoading(false);
        setIsRefreshing(false);
    };

    const handleAddEntry = async () => {
        if (!amount || !category) {
            Alert.alert("Required", "Amount and Category are mandatory");
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/workforce/daily-ledger`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({
                    transaction_type: entryType,
                    category: category,
                    amount: parseFloat(amount),
                    description: description,
                    date: selectedDate.toISOString().split('T')[0]
                })
            });

            if (response.ok) {
                Alert.alert("Success", "Entry added to daily ledger");
                setIsModalVisible(false);
                setAmount(''); setCategory(''); setDescription('');
                fetchLedger();
            }
        } catch (error) {
            Alert.alert("Error", "Network error");
        }
    };

    const totals = ledgerData.reduce((acc, curr) => {
        if (curr.transaction_type === 'INCOME') acc.income += curr.amount;
        else acc.expense += curr.amount;
        return acc;
    }, { income: 0, expense: 0 });

    const netBalance = totals.income - totals.expense;

    const onDateChange = (event, date) => {
        setShowDatePicker(false);
        if (date) setSelectedDate(date);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            
            {/* Custom Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#091426" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Daily Ledger</Text>
                    <Text style={styles.headerSubtitle}>Centralized Cash Flow • Admin</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => setIsModalVisible(true)}>
                    <MaterialCommunityIcons name="plus-circle" size={32} color="#006c49" />
                </TouchableOpacity>
            </View>

            {/* Filter Bar */}
            <View style={styles.filterBar}>
                <View style={styles.modeToggle}>
                    <TouchableOpacity 
                        style={[styles.modeBtn, filterMode === 'MONTH' && styles.modeBtnActive]} 
                        onPress={() => setFilterMode('MONTH')}
                    >
                        <Text style={[styles.modeText, filterMode === 'MONTH' && styles.modeTextActive]}>Monthly</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.modeBtn, filterMode === 'DAY' && styles.modeBtnActive]} 
                        onPress={() => setFilterMode('DAY')}
                    >
                        <Text style={[styles.modeText, filterMode === 'DAY' && styles.modeTextActive]}>Daily</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)}>
                    <MaterialCommunityIcons name="calendar-month" size={20} color="#64748B" />
                    <Text style={styles.dateSelectorText}>
                        {filterMode === 'MONTH' 
                            ? selectedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
                            : selectedDate.toLocaleDateString()
                        }
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={16} color="#64748B" />
                </TouchableOpacity>
            </View>

            {showDatePicker && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                />
            )}

            <ScrollView 
                style={styles.content} 
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); fetchLedger(); }} />}
            >
                {/* Summary Cards */}
                <View style={styles.summaryRow}>
                    <View style={[styles.summaryCard, { backgroundColor: '#ECFDF5', borderColor: '#10B981' }]}>
                        <Text style={[styles.summaryLabel, { color: '#059669' }]}>Total Income</Text>
                        <Text style={[styles.summaryValue, { color: '#065F46' }]}>₹{totals.income.toLocaleString()}</Text>
                        <MaterialCommunityIcons name="trending-up" size={24} color="#10B981" style={styles.summaryIcon} />
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}>
                        <Text style={[styles.summaryLabel, { color: '#DC2626' }]}>Total Expense</Text>
                        <Text style={[styles.summaryValue, { color: '#991B1B' }]}>₹{totals.expense.toLocaleString()}</Text>
                        <MaterialCommunityIcons name="trending-down" size={24} color="#EF4444" style={styles.summaryIcon} />
                    </View>
                </View>

                <View style={[styles.balanceBar, netBalance >= 0 ? styles.balancePositive : styles.balanceNegative]}>
                    <View>
                        <Text style={styles.balanceLabel}>Net Cash Flow</Text>
                        <Text style={styles.balanceValue}>₹{netBalance.toLocaleString()}</Text>
                    </View>
                    <MaterialCommunityIcons 
                        name={netBalance >= 0 ? "shield-check" : "alert-circle"} 
                        size={32} color="white" 
                    />
                </View>

                {/* Transactions List */}
                <View style={styles.listHeader}>
                    <Text style={styles.listTitle}>Recent Activity</Text>
                    <Text style={styles.listCount}>{ledgerData.length} entries</Text>
                </View>

                {isLoading ? (
                    <ActivityIndicator size="large" color="#091426" style={{ marginTop: 50 }} />
                ) : ledgerData.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="folder-open-outline" size={64} color="#CBD5E1" />
                        <Text style={styles.emptyText}>No data for this period</Text>
                    </View>
                ) : (
                    ledgerData.map((item) => (
                        <View key={item.id} style={styles.transactionCard}>
                            <View style={[styles.typeIndicator, { backgroundColor: item.transaction_type === 'INCOME' ? '#10B981' : '#EF4444' }]} />
                            <View style={styles.transMain}>
                                <View style={styles.transHeader}>
                                    <Text style={styles.transCategory}>{item.category.replace('_', ' ')}</Text>
                                    <Text style={[styles.transAmount, { color: item.transaction_type === 'INCOME' ? '#059669' : '#DC2626' }]}>
                                        {item.transaction_type === 'INCOME' ? '+' : '-'} ₹{item.amount.toLocaleString()}
                                    </Text>
                                </View>
                                <Text style={styles.transDesc}>{item.description || 'No description'}</Text>
                                <View style={styles.transFooter}>
                                    <View style={styles.tag}>
                                        <MaterialCommunityIcons name="clock-outline" size={12} color="#64748B" />
                                        <Text style={styles.tagText}>{new Date(item.date).toLocaleDateString()}</Text>
                                    </View>
                                    {item.reference_type && (
                                        <View style={[styles.tag, { backgroundColor: '#F1F5F9' }]}>
                                            <MaterialCommunityIcons name="link-variant" size={12} color="#091426" />
                                            <Text style={[styles.tagText, { color: '#091426' }]}>{item.reference_type}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* Add Entry Modal */}
            <Modal visible={isModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Manual Cash Entry</Text>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#091426" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.typeSwitcher}>
                            <TouchableOpacity 
                                style={[styles.typeBtn, entryType === 'INCOME' && styles.typeBtnIncome]} 
                                onPress={() => setEntryType('INCOME')}
                            >
                                <Text style={[styles.typeBtnText, entryType === 'INCOME' && styles.typeBtnTextActive]}>Income</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.typeBtn, entryType === 'EXPENSE' && styles.typeBtnExpense]} 
                                onPress={() => setEntryType('EXPENSE')}
                            >
                                <Text style={[styles.typeBtnText, entryType === 'EXPENSE' && styles.typeBtnTextActive]}>Expense</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.modalLabel}>Category / Source</Text>
                            <TextInput 
                                style={styles.modalInput} 
                                placeholder="e.g. Tea, Maintenance, Cash In" 
                                value={category} 
                                onChangeText={setCategory} 
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.modalLabel}>Amount (₹)</Text>
                            <TextInput 
                                style={[styles.modalInput, { fontSize: 24, fontWeight: 'bold' }]} 
                                placeholder="0" 
                                keyboardType="numeric" 
                                value={amount} 
                                onChangeText={setAmount} 
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.modalLabel}>Description (Optional)</Text>
                            <TextInput 
                                style={[styles.modalInput, { height: 80 }]} 
                                placeholder="Add more details..." 
                                multiline 
                                value={description} 
                                onChangeText={setDescription} 
                            />
                        </View>

                        <TouchableOpacity style={styles.saveBtn} onPress={handleAddEntry}>
                            <Text style={styles.saveBtnText}>Save Transaction</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10 },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    backBtn: { marginRight: 15 },
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#091426' },
    headerSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '600' },
    addBtn: { marginLeft: 'auto' },

    filterBar: { padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modeToggle: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 8, padding: 3 },
    modeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    modeBtnActive: { backgroundColor: 'white' },
    modeText: { fontSize: 12, fontWeight: 'bold', color: '#64748B' },
    modeTextActive: { color: '#091426' },
    
    dateSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
    dateSelectorText: { fontSize: 14, fontWeight: '700', color: '#091426' },

    content: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },

    summaryRow: { flexDirection: 'row', gap: 15, marginBottom: 15 },
    summaryCard: { flex: 1, padding: 15, borderRadius: 16, borderLeftWidth: 4, position: 'relative', overflow: 'hidden' },
    summaryLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    summaryValue: { fontSize: 20, fontWeight: '900', marginTop: 5 },
    summaryIcon: { position: 'absolute', right: -5, bottom: -5, opacity: 0.2 },

    balanceBar: { padding: 20, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    balancePositive: { backgroundColor: '#091426', elevation: 4 },
    balanceNegative: { backgroundColor: '#991B1B', elevation: 4 },
    balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    balanceValue: { color: 'white', fontSize: 32, fontWeight: '900' },

    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    listTitle: { fontSize: 18, fontWeight: '800', color: '#091426' },
    listCount: { fontSize: 13, color: '#64748B', fontWeight: 'bold' },

    transactionCard: { backgroundColor: 'white', borderRadius: 16, marginBottom: 12, flexDirection: 'row', overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    typeIndicator: { width: 5 },
    transMain: { flex: 1, padding: 15 },
    transHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    transCategory: { fontSize: 16, fontWeight: '800', color: '#091426', textTransform: 'capitalize' },
    transAmount: { fontSize: 17, fontWeight: '900' },
    transDesc: { fontSize: 13, color: '#64748B', marginTop: 4 },
    transFooter: { flexDirection: 'row', gap: 10, marginTop: 12 },
    tag: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    tagText: { fontSize: 11, fontWeight: 'bold', color: '#64748B' },

    emptyState: { alignItems: 'center', marginTop: 60 },
    emptyText: { color: '#94A3B8', fontWeight: 'bold', marginTop: 10 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalTitle: { fontSize: 22, fontWeight: '800', color: '#091426' },
    
    typeSwitcher: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 5, marginBottom: 25 },
    typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    typeBtnIncome: { backgroundColor: '#10B981' },
    typeBtnExpense: { backgroundColor: '#EF4444' },
    typeBtnText: { fontWeight: 'bold', color: '#64748B' },
    typeBtnTextActive: { color: 'white' },
    
    formGroup: { marginBottom: 20 },
    modalLabel: { fontSize: 12, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 8 },
    modalInput: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 15, fontSize: 16, color: '#091426', borderWidth: 1, borderColor: '#E2E8F0' },
    
    saveBtn: { backgroundColor: '#091426', borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 10 },
    saveBtnText: { color: 'white', fontSize: 18, fontWeight: '800' }
});
