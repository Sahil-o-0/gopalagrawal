import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, TextInput, ScrollView, ActivityIndicator, Modal, StatusBar, Platform, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AuthContext } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import SiteSelector from '../components/SiteSelector';
import { API_BASE_URL } from '../config';

export default function DailyLedgerScreen({ navigation }) {
    const { userToken, user } = useContext(AuthContext);
    const { selectedSite } = useSite();
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [ledgerData, setLedgerData] = useState([]);
    const [staffList, setStaffList] = useState([]);
    
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
    const [selectedStaffId, setSelectedStaffId] = useState('');
    const [isStaffPickerVisible, setIsStaffPickerVisible] = useState(false);

    // Preset category tags
    const expenseCategories = ['WAGE_PAYOUT', 'ADVANCE', 'FUEL', 'MAINTENANCE', 'SITE_EXPENSE', 'TEA_SNACKS', 'OTHER'];
    const incomeCategories = ['TRIP_INCOME', 'CLIENT_PAYMENT', 'MISC_INCOME', 'OTHER'];

    useEffect(() => {
        fetchLedger();
        fetchStaff();
    }, [selectedDate, filterMode, selectedSite?.id]);

    const fetchStaff = async () => {
        try {
            const resp = await fetch(`${API_BASE_URL}/users/`, {
                headers: { 'Authorization': `Bearer ${userToken}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                setStaffList(data);
            }
        } catch (e) {
            console.log("Error fetching staff:", e);
        }
    };

    const fetchLedger = async () => {
        setIsLoading(true);
        try {
            let url = `${API_BASE_URL}/workforce/daily-ledger?`;
            if (filterMode === 'DAY') {
                url += `date=${selectedDate.toISOString().split('T')[0]}`;
            } else {
                url += `month=${selectedDate.getMonth() + 1}&year=${selectedDate.getFullYear()}`;
            }
            if (selectedSite?.id) {
                url += `&site_id=${selectedSite.id}`;
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

        const isStaffPayment = category === 'WAGE_PAYOUT' || category === 'ADVANCE' || category === 'SALARY';
        if (isStaffPayment && !selectedStaffId) {
            Alert.alert("Required", "Please select a staff member for this wage / advance payment");
            return;
        }

        const chosenStaff = staffList.find(s => s.id.toString() === selectedStaffId);
        const staffName = chosenStaff ? (chosenStaff.full_name || chosenStaff.username) : '';

        try {
            if (isStaffPayment) {
                // If it's a wage or advance payment, record it through staff-ledger so it updates user balance & daily ledger
                const tType = category === 'ADVANCE' ? 'ADVANCE' : 'PAYMENT';
                const sResp = await fetch(`${API_BASE_URL}/workforce/staff-ledger`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${userToken}`
                    },
                    body: JSON.stringify({
                        staff_id: parseInt(selectedStaffId),
                        site_id: selectedSite?.id || 1,
                        amount: category === 'ADVANCE' ? -Math.abs(parseFloat(amount)) : -Math.abs(parseFloat(amount)),
                        transaction_type: tType,
                        description: description ? `${description} (${staffName})` : `${category.replace(/_/g, ' ')} to ${staffName}`,
                        date: selectedDate.toISOString().split('T')[0]
                    })
                });

                if (sResp.ok) {
                    Alert.alert("Success", `Payment recorded for ${staffName} and logged in Accounting!`);
                    setIsModalVisible(false);
                    resetModal();
                    fetchLedger();
                    return;
                }
            }

            // General Daily Ledger Entry
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
                    description: description ? (staffName ? `${description} (${staffName})` : description) : (staffName ? `${category} - ${staffName}` : ''),
                    date: selectedDate.toISOString().split('T')[0],
                    site_id: selectedSite?.id || 1
                })
            });

            if (response.ok) {
                Alert.alert("Success", "Entry added to daily ledger");
                setIsModalVisible(false);
                resetModal();
                fetchLedger();
            }
        } catch (error) {
            Alert.alert("Error", "Network error");
        }
    };

    const resetModal = () => {
        setAmount('');
        setCategory('');
        setDescription('');
        setSelectedStaffId('');
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
            
            {/* Top Bar Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <SiteSelector compact={true} />
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => setIsModalVisible(true)} activeOpacity={0.8}>
                    <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
                    <Text style={styles.addBtnLabel}>Entry</Text>
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

                <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="calendar-month-outline" size={18} color="#0284C7" />
                    <Text style={styles.dateSelectorText}>
                        {filterMode === 'MONTH' 
                            ? selectedDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                            : `${String(selectedDate.getDate()).padStart(2, '0')}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${selectedDate.getFullYear()}`
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
                showsVerticalScrollIndicator={false}
            >
                {/* Net Balance Hero Card */}
                <View style={[styles.balanceBar, netBalance >= 0 ? styles.balancePositive : styles.balanceNegative]}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <MaterialCommunityIcons name="wallet-outline" size={16} color="rgba(255,255,255,0.75)" />
                            <Text style={styles.balanceLabel}>NET CASH FLOW</Text>
                        </View>
                        <Text style={styles.balanceValue}>
                            {netBalance < 0 ? '-' : ''}₹{Math.abs(netBalance).toLocaleString()}
                        </Text>
                        <Text style={styles.balanceSub}>
                            {filterMode === 'MONTH' 
                                ? `Cash balance for ${selectedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
                                : `Cash balance for selected day`
                            }
                        </Text>
                    </View>
                    <View style={styles.heroBadge}>
                        <MaterialCommunityIcons 
                            name={netBalance >= 0 ? "trending-up" : "trending-down"} 
                            size={28} color="white" 
                        />
                    </View>
                </View>

                {/* Summary Cards */}
                <View style={styles.summaryRow}>
                    <View style={[styles.summaryCard, { borderLeftColor: '#10B981' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[styles.summaryLabel, { color: '#059669' }]}>Total Inflow</Text>
                            <View style={[styles.statIconBadge, { backgroundColor: '#ECFDF5' }]}>
                                <MaterialCommunityIcons name="arrow-bottom-left" size={16} color="#059669" />
                            </View>
                        </View>
                        <Text style={[styles.summaryValue, { color: '#065F46' }]}>₹{totals.income.toLocaleString()}</Text>
                        <Text style={styles.summaryMeta}>Verified revenue & earnings</Text>
                    </View>

                    <View style={[styles.summaryCard, { borderLeftColor: '#EF4444' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[styles.summaryLabel, { color: '#DC2626' }]}>Total Outflow</Text>
                            <View style={[styles.statIconBadge, { backgroundColor: '#FEF2F2' }]}>
                                <MaterialCommunityIcons name="arrow-top-right" size={16} color="#DC2626" />
                            </View>
                        </View>
                        <Text style={[styles.summaryValue, { color: '#991B1B' }]}>₹{totals.expense.toLocaleString()}</Text>
                        <Text style={styles.summaryMeta}>Operations & labor costs</Text>
                    </View>
                </View>

                {/* Transactions List Header */}
                <View style={styles.listHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <MaterialCommunityIcons name="receipt-text-outline" size={20} color="#0F172A" />
                        <Text style={styles.listTitle}>Activity Ledger</Text>
                    </View>
                    <View style={styles.countBadge}>
                        <Text style={styles.listCount}>{ledgerData.length} records</Text>
                    </View>
                </View>

                {isLoading ? (
                    <ActivityIndicator size="large" color="#0F172A" style={{ marginTop: 40 }} />
                ) : ledgerData.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconBox}>
                            <MaterialCommunityIcons name="book-open-blank-variant" size={42} color="#94A3B8" />
                        </View>
                        <Text style={styles.emptyTitle}>No Entries Found</Text>
                        <Text style={styles.emptyText}>No cash transactions logged for this selected period.</Text>
                    </View>
                ) : (
                    ledgerData.map((item) => {
                        const isIncome = item.transaction_type === 'INCOME';
                        return (
                            <View key={item.id} style={styles.transactionCard}>
                                <View style={[styles.typePillIcon, { backgroundColor: isIncome ? '#ECFDF5' : '#FEF2F2' }]}>
                                    <MaterialCommunityIcons 
                                        name={isIncome ? "arrow-down-bold" : "arrow-up-bold"} 
                                        size={18} 
                                        color={isIncome ? "#059669" : "#DC2626"} 
                                    />
                                </View>
                                <View style={styles.transMain}>
                                    <View style={styles.transHeader}>
                                        <Text style={styles.transCategory}>{item.category?.replace(/_/g, ' ')}</Text>
                                        <Text style={[styles.transAmount, { color: isIncome ? '#059669' : '#DC2626' }]}>
                                            {isIncome ? '+' : '-'}₹{item.amount?.toLocaleString()}
                                        </Text>
                                    </View>
                                    {item.description ? (
                                        <Text style={styles.transDesc}>{item.description}</Text>
                                    ) : null}
                                    <View style={styles.transFooter}>
                                        <View style={styles.tag}>
                                            <MaterialCommunityIcons name="calendar-clock" size={12} color="#64748B" />
                                            <Text style={styles.tagText}>
                                                {(() => {
                                                    const d = new Date(item.date);
                                                    const dd = String(d.getDate()).padStart(2, '0');
                                                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                                                    const yyyy = d.getFullYear();
                                                    return `${dd}-${mm}-${yyyy}`;
                                                })()}
                                            </Text>
                                        </View>
                                        {item.reference_type ? (
                                            <View style={[styles.tag, { backgroundColor: '#F1F5F9' }]}>
                                                <MaterialCommunityIcons name="link-variant" size={12} color="#0F172A" />
                                                <Text style={[styles.tagText, { color: '#0F172A' }]}>{item.reference_type}</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* Add Entry Modal */}
            <Modal visible={isModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '90%' }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>New Cash Entry</Text>
                                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Record daily revenue, operations, or staff wages/advances</Text>
                            </View>
                            <TouchableOpacity onPress={() => { setIsModalVisible(false); resetModal(); }}>
                                <MaterialCommunityIcons name="close" size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Type Switcher */}
                            <View style={styles.typeSwitcher}>
                                <TouchableOpacity 
                                    style={[styles.typeBtn, entryType === 'INCOME' && styles.typeBtnIncome]} 
                                    onPress={() => { setEntryType('INCOME'); setCategory('TRIP_INCOME'); }}
                                >
                                    <MaterialCommunityIcons name="arrow-bottom-left" size={16} color={entryType === 'INCOME' ? '#FFFFFF' : '#059669'} />
                                    <Text style={[styles.typeBtnText, entryType === 'INCOME' && styles.typeBtnTextActive]}>Cash Inflow</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.typeBtn, entryType === 'EXPENSE' && styles.typeBtnExpense]} 
                                    onPress={() => { setEntryType('EXPENSE'); setCategory('WAGE_PAYOUT'); }}
                                >
                                    <MaterialCommunityIcons name="arrow-top-right" size={16} color={entryType === 'EXPENSE' ? '#FFFFFF' : '#DC2626'} />
                                    <Text style={[styles.typeBtnText, entryType === 'EXPENSE' && styles.typeBtnTextActive]}>Cash Outflow</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Category Selector Pills */}
                            <View style={styles.formGroup}>
                                <Text style={styles.modalLabel}>Category</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                                    {(entryType === 'EXPENSE' ? expenseCategories : incomeCategories).map(cat => (
                                        <TouchableOpacity
                                            key={cat}
                                            style={[styles.catPill, category === cat && styles.catPillActive]}
                                            onPress={() => setCategory(cat)}
                                        >
                                            <Text style={[styles.catPillText, category === cat && styles.catPillTextActive]}>
                                                {cat.replace(/_/g, ' ')}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Staff / Employee Selection (shown if Wage / Advance / Salary or chosen) */}
                            {(category === 'WAGE_PAYOUT' || category === 'ADVANCE' || category === 'SALARY' || entryType === 'EXPENSE') && (
                                <View style={styles.formGroup}>
                                    <Text style={styles.modalLabel}>Select Employee / Staff (Optional)</Text>
                                    <TouchableOpacity 
                                        style={styles.staffSelectTrigger} 
                                        onPress={() => setIsStaffPickerVisible(true)}
                                        activeOpacity={0.75}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                            <MaterialCommunityIcons name="account-outline" size={20} color="#64748B" />
                                            <Text style={selectedStaffId ? styles.staffSelectVal : styles.staffSelectPlaceholder}>
                                                {selectedStaffId 
                                                    ? staffList.find(s => s.id.toString() === selectedStaffId)?.full_name || staffList.find(s => s.id.toString() === selectedStaffId)?.username 
                                                    : "Select Staff for Wage / Advance"}
                                            </Text>
                                        </View>
                                        {selectedStaffId ? (
                                            <TouchableOpacity onPress={() => setSelectedStaffId('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                                <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
                                            </TouchableOpacity>
                                        ) : (
                                            <MaterialCommunityIcons name="chevron-down" size={18} color="#64748B" />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Amount */}
                            <View style={styles.formGroup}>
                                <Text style={styles.modalLabel}>Amount (₹) *</Text>
                                <View style={styles.amountInputRow}>
                                    <Text style={styles.currencyPrefix}>₹</Text>
                                    <TextInput 
                                        style={styles.amountInput} 
                                        placeholder="0" 
                                        placeholderTextColor="#94A3B8"
                                        keyboardType="numeric" 
                                        value={amount} 
                                        onChangeText={setAmount} 
                                    />
                                </View>
                            </View>

                            {/* Description */}
                            <View style={styles.formGroup}>
                                <Text style={styles.modalLabel}>Note / Description</Text>
                                <TextInput 
                                    style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]} 
                                    placeholder="Enter additional details or remarks..." 
                                    placeholderTextColor="#94A3B8"
                                    multiline 
                                    value={description} 
                                    onChangeText={setDescription} 
                                />
                            </View>

                            <TouchableOpacity style={styles.saveBtn} onPress={handleAddEntry} activeOpacity={0.85}>
                                <MaterialCommunityIcons name="check-circle" size={18} color="#FFFFFF" />
                                <Text style={styles.saveBtnText}>Save Entry</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Staff Picker Modal */}
            <Modal visible={isStaffPickerVisible} transparent animationType="fade">
                <TouchableOpacity style={styles.pickerModalOverlay} activeOpacity={1} onPress={() => setIsStaffPickerVisible(false)}>
                    <View style={styles.pickerModalContent}>
                        <View style={styles.pickerModalHeader}>
                            <Text style={styles.pickerModalTitle}>Select Staff Member</Text>
                            <TouchableOpacity onPress={() => setIsStaffPickerVisible(false)}>
                                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {staffList.filter(u => u.role !== 'ADMIN').map(u => (
                                <TouchableOpacity 
                                    key={u.id} 
                                    style={styles.staffOptionRow}
                                    onPress={() => {
                                        setSelectedStaffId(u.id.toString());
                                        setIsStaffPickerVisible(false);
                                    }}
                                >
                                    <View>
                                        <Text style={styles.staffOptionName}>{u.full_name || u.username}</Text>
                                        <Text style={styles.staffOptionSub}>@{u.username} • {u.designation || u.role}</Text>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#F8FAFC', 
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0 
    },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16, 
        paddingVertical: 12, 
        backgroundColor: '#FFFFFF', 
        borderBottomWidth: 1, 
        borderBottomColor: '#E2E8F0' 
    },
    backBtn: { padding: 4 },
    addBtn: { 
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        gap: 4
    },
    addBtnLabel: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 13
    },

    filterBar: { 
        paddingHorizontal: 16, 
        paddingVertical: 12, 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    modeToggle: { 
        flexDirection: 'row', 
        backgroundColor: '#F1F5F9', 
        borderRadius: 8, 
        padding: 3 
    },
    modeBtn: { 
        paddingHorizontal: 12, 
        paddingVertical: 6, 
        borderRadius: 6 
    },
    modeBtnActive: { 
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        elevation: 1
    },
    modeText: { 
        fontSize: 12, 
        fontWeight: '700', 
        color: '#64748B' 
    },
    modeTextActive: { 
        color: '#0F172A' 
    },
    
    dateSelector: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#F8FAFC', 
        paddingHorizontal: 12, 
        paddingVertical: 7, 
        borderRadius: 8, 
        borderWidth: 1, 
        borderColor: '#E2E8F0', 
        gap: 6 
    },
    dateSelectorText: { 
        fontSize: 13, 
        fontWeight: '700', 
        color: '#0F172A' 
    },

    content: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },

    balanceBar: { 
        padding: 20, 
        borderRadius: 16, 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 16,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 4
    },
    balancePositive: { backgroundColor: '#0F172A' },
    balanceNegative: { backgroundColor: '#991B1B' },
    balanceLabel: { 
        color: 'rgba(255,255,255,0.75)', 
        fontSize: 11, 
        fontWeight: '800', 
        letterSpacing: 1 
    },
    balanceValue: { 
        color: '#FFFFFF', 
        fontSize: 32, 
        fontWeight: '900',
        letterSpacing: -0.5
    },
    balanceSub: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: 12,
        fontWeight: '500',
        marginTop: 4
    },
    heroBadge: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center'
    },

    summaryRow: { 
        flexDirection: 'row', 
        gap: 12, 
        marginBottom: 20 
    },
    summaryCard: { 
        flex: 1, 
        backgroundColor: '#FFFFFF',
        padding: 14, 
        borderRadius: 14, 
        borderLeftWidth: 4, 
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2 
    },
    summaryLabel: { 
        fontSize: 11, 
        fontWeight: '800', 
        textTransform: 'uppercase', 
        letterSpacing: 0.5 
    },
    summaryValue: { 
        fontSize: 20, 
        fontWeight: '900', 
        marginTop: 6,
        letterSpacing: -0.5
    },
    summaryMeta: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '500',
        marginTop: 4
    },
    statIconBadge: {
        width: 24,
        height: 24,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center'
    },

    listHeader: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 12 
    },
    listTitle: { 
        fontSize: 16, 
        fontWeight: '800', 
        color: '#0F172A' 
    },
    countBadge: {
        backgroundColor: '#E2E8F0',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12
    },
    listCount: { 
        fontSize: 11, 
        color: '#334155', 
        fontWeight: '800',
        textTransform: 'uppercase'
    },

    transactionCard: { 
        backgroundColor: '#FFFFFF', 
        borderRadius: 14, 
        marginBottom: 10, 
        flexDirection: 'row', 
        alignItems: 'flex-start',
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 1 }, 
        shadowOpacity: 0.03, 
        shadowRadius: 3, 
        elevation: 1 
    },
    typePillIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    transMain: { flex: 1 },
    transHeader: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start' 
    },
    transCategory: { 
        fontSize: 15, 
        fontWeight: '700', 
        color: '#0F172A', 
        textTransform: 'capitalize' 
    },
    transAmount: { 
        fontSize: 16, 
        fontWeight: '900' 
    },
    transDesc: { 
        fontSize: 13, 
        color: '#64748B', 
        marginTop: 4,
        lineHeight: 18
    },
    transFooter: { 
        flexDirection: 'row', 
        gap: 8, 
        marginTop: 10 
    },
    tag: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 4, 
        backgroundColor: '#F8FAFC', 
        paddingHorizontal: 8, 
        paddingVertical: 3, 
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    tagText: { 
        fontSize: 11, 
        fontWeight: '600', 
        color: '#64748B' 
    },

    emptyState: { 
        alignItems: 'center', 
        paddingTop: 50,
        paddingHorizontal: 20
    },
    emptyIconBox: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 4
    },
    emptyText: { 
        color: '#94A3B8', 
        fontWeight: '500', 
        fontSize: 13,
        textAlign: 'center' 
    },

    modalOverlay: { 
        flex: 1, 
        backgroundColor: 'rgba(15,23,42,0.5)', 
        justifyContent: 'flex-end' 
    },
    modalContent: { 
        backgroundColor: '#FFFFFF', 
        borderTopLeftRadius: 24, 
        borderTopRightRadius: 24, 
        padding: 24, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: -4 }, 
        shadowOpacity: 0.1, 
        shadowRadius: 8, 
        elevation: 20 
    },
    modalHeader: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 20 
    },
    modalTitle: { 
        fontSize: 18, 
        fontWeight: '800', 
        color: '#0F172A' 
    },
    
    typeSwitcher: { 
        flexDirection: 'row', 
        backgroundColor: '#F1F5F9', 
        borderRadius: 10, 
        padding: 4, 
        marginBottom: 20 
    },
    typeBtn: { 
        flex: 1, 
        paddingVertical: 10, 
        borderRadius: 8, 
        alignItems: 'center' 
    },
    typeBtnIncome: { backgroundColor: '#10B981' },
    typeBtnExpense: { backgroundColor: '#EF4444' },
    typeBtnText: { fontWeight: '700', color: '#64748B', fontSize: 13 },
    typeBtnTextActive: { color: '#FFFFFF' },
    
    formGroup: { marginBottom: 16 },
    modalLabel: { 
        fontSize: 11, 
        fontWeight: '700', 
        color: '#64748B', 
        textTransform: 'uppercase', 
        letterSpacing: 0.5,
        marginBottom: 6 
    },
    modalInput: { 
        backgroundColor: '#F8FAFC', 
        borderRadius: 10, 
        paddingHorizontal: 14, 
        paddingVertical: 12, 
        fontSize: 15, 
        color: '#0F172A', 
        borderWidth: 1, 
        borderColor: '#E2E8F0' 
    },
    
    saveBtn: { 
        backgroundColor: '#0F172A', 
        borderRadius: 12, 
        paddingVertical: 14, 
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center', 
        marginTop: 10,
        gap: 6,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3
    },
    saveBtnText: { 
        color: '#FFFFFF', 
        fontSize: 15, 
        fontWeight: '800' 
    },

    catPill: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    catPillActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    catPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },
    catPillTextActive: {
        color: '#FFFFFF',
    },

    staffSelectTrigger: {
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    staffSelectVal: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    staffSelectPlaceholder: {
        fontSize: 14,
        color: '#94A3B8',
    },

    amountInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 14,
    },
    currencyPrefix: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
        marginRight: 6,
    },
    amountInput: {
        flex: 1,
        fontSize: 22,
        fontWeight: '800',
        color: '#0F172A',
        paddingVertical: 10,
    },

    pickerModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15,23,42,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    pickerModalContent: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        elevation: 10,
    },
    pickerModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    pickerModalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
    },
    staffOptionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    staffOptionName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
    },
    staffOptionSub: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
});
