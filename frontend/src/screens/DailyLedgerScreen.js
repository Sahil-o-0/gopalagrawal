import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView, ActivityIndicator, Modal, StatusBar, Platform, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AuthContext } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import SiteSelector from '../components/SiteSelector';
import { API_BASE_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { saveRequestOffline } from '../context/OfflineStorage';
import { useBackgroundSync } from '../context/useBackgroundSync';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import DraggableCardList from '../components/DraggableCardList';

export default function DailyLedgerScreen({ navigation }) {
    const { userToken, user } = useContext(AuthContext);
    const { selectedSite } = useSite();
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [ledgerData, setLedgerData] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const { isOnline, pendingCount } = useBackgroundSync();

    // Client Khata (Khatabook) State
    const CLIENTS_STORAGE_KEY = '@fleet_client_khata_clients_v2';
    const CLIENTS_TXN_STORAGE_KEY = '@fleet_client_khata_txns_v2';
    const [clients, setClients] = useState([]);
    const [clientTransactions, setClientTransactions] = useState([]);
    const [clientSearch, setClientSearch] = useState('');

    const clientScrollViewRef = useRef(null);
    const clientScrollYRef = useRef(0);

    // Add Client Modal State
    const [isAddClientModalVisible, setIsAddClientModalVisible] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [newClientAddress, setNewClientAddress] = useState('');
    const [newClientOpeningBalance, setNewClientOpeningBalance] = useState('');

    // Edit Client Modal State
    const [isEditClientModalVisible, setIsEditClientModalVisible] = useState(false);
    const [clientToEdit, setClientToEdit] = useState(null);
    const [editClientName, setEditClientName] = useState('');
    const [editClientPhone, setEditClientPhone] = useState('');
    const [editClientAddress, setEditClientAddress] = useState('');
    const [editClientOpeningBalance, setEditClientOpeningBalance] = useState('');

    // Record Client Transaction Modal State
    const [isClientTxnModalVisible, setIsClientTxnModalVisible] = useState(false);
    const [editingClientTxn, setEditingClientTxn] = useState(null);
    const [selectedClientForTxn, setSelectedClientForTxn] = useState(null);
    const [clientTxnType, setClientTxnType] = useState('BILLED'); // BILLED, RECEIVED, ADVANCE
    const [clientTxnAmount, setClientTxnAmount] = useState('');
    const [clientTxnDate, setClientTxnDate] = useState(new Date());
    const [showClientTxnDatePicker, setShowClientTxnDatePicker] = useState(false);
    const [clientTxnMode, setClientTxnMode] = useState('CASH'); // CASH, ONLINE, CHEQUE
    const [clientTxnNotes, setClientTxnNotes] = useState('');
    const [syncClientTxnToDaily, setSyncClientTxnToDaily] = useState(true);

    // Client Statement Modal State
    const [isClientStatementModalVisible, setIsClientStatementModalVisible] = useState(false);
    const [selectedClientForStatement, setSelectedClientForStatement] = useState(null);

    // Client Khata Stats Filter State ('ALL' | 'DUE' | 'ADVANCE' | 'SETTLED')
    const [clientKhataFilter, setClientKhataFilter] = useState('ALL');

    // Date-Wise Report (matching khatabahi.jpeg) States
    const [reportStartDate, setReportStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 13);
        return d;
    });
    const [reportEndDate, setReportEndDate] = useState(new Date());
    const [showReportStartDatePicker, setShowReportStartDatePicker] = useState(false);
    const [showReportEndDatePicker, setShowReportEndDatePicker] = useState(false);
    const [isReportFilterModalVisible, setIsReportFilterModalVisible] = useState(false);
    const [reportPartyFilter, setReportPartyFilter] = useState('ALL');
    const [reportExpandedDate, setReportExpandedDate] = useState(null);

    // Export Action Sheet Modal States
    const [isExportModalVisible, setIsExportModalVisible] = useState(false);
    const [exportTarget, setExportTarget] = useState(null); // { type: 'CLIENT_STATEMENT', client } or { type: 'DATE_REPORT', ... }
    const [isExporting, setIsExporting] = useState(false);

    // Client Dropdown Picker and Search States
    const [clientSearchText, setClientSearchText] = useState('');
    const [isClientPickerVisible, setIsClientPickerVisible] = useState(false);
    const [isClientArrangeMode, setIsClientArrangeMode] = useState(false);
    const [clientLoading, setClientLoading] = useState(false);

    useEffect(() => {
        loadClientKhata();
    }, [userToken, selectedSite?.id]);

    const loadClientKhata = async () => {
        try {
            setClientLoading(true);
            // 1. Instant load from local cache for immediate display
            const storedClients = await AsyncStorage.getItem(CLIENTS_STORAGE_KEY);
            const storedTxns = await AsyncStorage.getItem(CLIENTS_TXN_STORAGE_KEY);
            if (storedClients) {
                try { setClients(JSON.parse(storedClients)); } catch(e){}
            }
            if (storedTxns) {
                try { setClientTransactions(JSON.parse(storedTxns)); } catch(e){}
            }

            // 2. Fetch fresh cloud data from backend API
            if (userToken) {
                const clientsUrl = `${API_BASE_URL}/clients/${selectedSite?.id ? `?site_id=${selectedSite.id}` : ''}`;
                const txnsUrl = `${API_BASE_URL}/clients/transactions/all`;

                const [clientsRes, txnsRes] = await Promise.all([
                    fetch(clientsUrl, { headers: { 'Authorization': `Bearer ${userToken}` } }),
                    fetch(txnsUrl, { headers: { 'Authorization': `Bearer ${userToken}` } })
                ]);

                if (clientsRes.ok && txnsRes.ok) {
                    const serverClients = await clientsRes.json();
                    const serverTxns = await txnsRes.json();

                    // If cloud DB is empty but client mobile has local accounts (e.g. 19,01,092 data!),
                    // auto-migrate local data to cloud so all mobiles stay synced!
                    if (serverClients.length === 0 && storedClients) {
                        try {
                            const localClients = JSON.parse(storedClients);
                            const localTxns = storedTxns ? JSON.parse(storedTxns) : [];
                            if (localClients.length > 0) {
                                for (const lc of localClients) {
                                    const postRes = await fetch(`${API_BASE_URL}/clients/`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${userToken}`
                                        },
                                        body: JSON.stringify({
                                            name: lc.name,
                                            phone: lc.phone || null,
                                            address: lc.address || null,
                                            opening_balance: parseFloat(lc.opening_balance) || 0,
                                            site_id: selectedSite?.id || null
                                        })
                                    });
                                    if (postRes.ok) {
                                        const createdC = await postRes.json();
                                        const matchingTxns = localTxns.filter(t => String(t.client_id) === String(lc.id));
                                        for (const lt of matchingTxns) {
                                            await fetch(`${API_BASE_URL}/clients/transactions`, {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'Authorization': `Bearer ${userToken}`
                                                },
                                                body: JSON.stringify({
                                                    client_id: createdC.id,
                                                    txn_type: lt.type || lt.txn_type || 'BILLED',
                                                    amount: parseFloat(lt.amount) || 0,
                                                    date: lt.date || new Date().toISOString().split('T')[0],
                                                    payment_mode: lt.payment_mode || 'CASH',
                                                    notes: lt.notes || null
                                                })
                                            });
                                        }
                                    }
                                }
                                const [freshC, freshT] = await Promise.all([
                                    fetch(clientsUrl, { headers: { 'Authorization': `Bearer ${userToken}` } }),
                                    fetch(txnsUrl, { headers: { 'Authorization': `Bearer ${userToken}` } })
                                ]);
                                if (freshC.ok && freshT.ok) {
                                    const fc = await freshC.json();
                                    const ft = await freshT.json();
                                    setClients(fc);
                                    setClientTransactions(ft);
                                    await AsyncStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(fc));
                                    await AsyncStorage.setItem(CLIENTS_TXN_STORAGE_KEY, JSON.stringify(ft));
                                    setClientLoading(false);
                                    return;
                                }
                            }
                        } catch (migErr) {
                            console.log('Migration error:', migErr);
                        }
                    }

                    setClients(serverClients);
                    setClientTransactions(serverTxns);
                    await AsyncStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(serverClients));
                    await AsyncStorage.setItem(CLIENTS_TXN_STORAGE_KEY, JSON.stringify(serverTxns));
                }
            }
        } catch (e) {
            console.log('Error loading client khata:', e);
        } finally {
            setClientLoading(false);
        }
    };

    const saveClientsToStorage = async (updated) => {
        setClients(updated);
        await AsyncStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(updated));
    };

    const saveTxnsToStorage = async (updated) => {
        setClientTransactions(updated);
        await AsyncStorage.setItem(CLIENTS_TXN_STORAGE_KEY, JSON.stringify(updated));
    };

    const handleReorderClients = async (reordered) => {
        setClients(reordered);
        await AsyncStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(reordered));
        if (userToken && isOnline) {
            try {
                await fetch(`${API_BASE_URL}/clients/reorder`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${userToken}`
                    },
                    body: JSON.stringify({
                        orders: reordered.map((c, idx) => ({ id: c.id, display_order: idx }))
                    })
                });
            } catch (err) {
                console.log('Error syncing client reorder:', err);
            }
        }
    };

    const handleAddClient = async () => {
        if (!newClientName.trim()) {
            Alert.alert('Missing Name', 'Please enter client or company name.');
            return;
        }

        const payload = {
            name: newClientName.trim(),
            phone: newClientPhone.trim() || null,
            address: newClientAddress.trim() || null,
            opening_balance: parseFloat(newClientOpeningBalance) || 0,
            site_id: selectedSite?.id || null
        };

        try {
            if (userToken && isOnline) {
                const res = await fetch(`${API_BASE_URL}/clients/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${userToken}`
                    },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const createdClient = await res.json();
                    const updated = [createdClient, ...clients];
                    await saveClientsToStorage(updated);
                    setNewClientName('');
                    setNewClientPhone('');
                    setNewClientAddress('');
                    setNewClientOpeningBalance('');
                    setIsAddClientModalVisible(false);
                    Alert.alert('Client Added', `Client "${createdClient.name}" added to cloud Khatabook.`);
                    return;
                }
            }
        } catch (err) {
            console.log('Cloud client create error:', err);
        }

        // Offline fallback
        const localClient = {
            id: Date.now(),
            ...payload,
            created_at: new Date().toISOString()
        };
        const updated = [localClient, ...clients];
        await saveClientsToStorage(updated);
        setNewClientName('');
        setNewClientPhone('');
        setNewClientAddress('');
        setNewClientOpeningBalance('');
        setIsAddClientModalVisible(false);
        Alert.alert('Client Added', `Client "${localClient.name}" added.`);
    };

    const handleCall = (phoneNumber) => {
        if (!phoneNumber) {
            Alert.alert('No Number', 'No phone number is saved for this client.');
            return;
        }
        const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
        const url = Platform.OS === 'android' ? `tel:${cleanNumber}` : `telprompt:${cleanNumber}`;
        Linking.openURL(url).catch(() => {
            Alert.alert('Cannot Open Dialer', 'Could not open phone dialer on your device.');
        });
    };

    const openEditClientModal = (client) => {
        setClientToEdit(client);
        setEditClientName(client.name || '');
        setEditClientPhone(client.phone || '');
        setEditClientAddress(client.address || '');
        setEditClientOpeningBalance(client.opening_balance !== undefined && client.opening_balance !== null ? String(client.opening_balance) : '0');
        setIsEditClientModalVisible(true);
    };

    const handleSaveEditedClient = async () => {
        if (!clientToEdit) return;
        if (!editClientName.trim()) {
            Alert.alert('Missing Name', 'Client name cannot be empty.');
            return;
        }

        const updatePayload = {
            name: editClientName.trim(),
            phone: editClientPhone.trim() || null,
            address: editClientAddress.trim() || null,
            opening_balance: parseFloat(editClientOpeningBalance) || 0,
        };

        try {
            if (userToken && isOnline && clientToEdit.id) {
                await fetch(`${API_BASE_URL}/clients/${clientToEdit.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${userToken}`
                    },
                    body: JSON.stringify(updatePayload)
                });
            }
        } catch (err) {
            console.log('Cloud client edit error:', err);
        }

        const updated = clients.map(c => {
            if (c.id === clientToEdit.id) {
                return {
                    ...c,
                    ...updatePayload
                };
            }
            return c;
        });
        await saveClientsToStorage(updated);
        setIsEditClientModalVisible(false);
        setClientToEdit(null);
        Alert.alert('Updated', 'Client details saved successfully.');
    };

    const handleDeleteClient = (client) => {
        Alert.alert(
            'Delete Client',
            `Are you sure you want to delete "${client.name}"? This will also remove all associated Khatabook transactions.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Permanently',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            if (userToken && isOnline && client.id) {
                                await fetch(`${API_BASE_URL}/clients/${client.id}`, {
                                    method: 'DELETE',
                                    headers: { 'Authorization': `Bearer ${userToken}` }
                                });
                            }
                        } catch (err) {
                            console.log('Cloud client delete error:', err);
                        }

                        const updatedClients = clients.filter(c => c.id !== client.id);
                        const updatedTxns = clientTransactions.filter(t => String(t.client_id) !== String(client.id));
                        await saveClientsToStorage(updatedClients);
                        await saveTxnsToStorage(updatedTxns);
                        if (selectedClientForStatement?.id === client.id) {
                            setIsClientStatementModalVisible(false);
                        }
                        Alert.alert('Deleted', `Client "${client.name}" has been removed.`);
                    }
                }
            ]
        );
    };

    const openEditTxnModal = (txn, client) => {
        setSelectedClientForTxn(client || clients.find(c => String(c.id) === String(txn.client_id)));
        setEditingClientTxn(txn);
        setClientTxnType(txn.type || txn.txn_type || 'BILLED');
        setClientTxnAmount(String(txn.amount || ''));
        setClientTxnDate(txn.date ? new Date(txn.date) : new Date());
        setClientTxnMode(txn.payment_mode || 'CASH');
        setClientTxnNotes(txn.notes || '');
        setSyncClientTxnToDaily(false);
        setIsClientTxnModalVisible(true);
    };

    const handleRecordClientTxn = async () => {
        if (!selectedClientForTxn) {
            Alert.alert('Error', 'Please select a client.');
            return;
        }
        const amt = parseFloat(clientTxnAmount);
        if (!amt || amt <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount.');
            return;
        }

        const dateStr = clientTxnDate.toISOString().split('T')[0];

        if (editingClientTxn) {
            const editPayload = {
                txn_type: clientTxnType,
                amount: amt,
                date: dateStr,
                payment_mode: clientTxnMode,
                notes: clientTxnNotes.trim() || null,
            };

            try {
                if (userToken && isOnline && editingClientTxn.id) {
                    await fetch(`${API_BASE_URL}/clients/transactions/${editingClientTxn.id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${userToken}`
                        },
                        body: JSON.stringify(editPayload)
                    });
                }
            } catch (err) {
                console.log('Cloud txn edit error:', err);
            }

            const updatedTxns = clientTransactions.map(t => {
                if (t.id === editingClientTxn.id) {
                    return {
                        ...t,
                        type: clientTxnType,
                        txn_type: clientTxnType,
                        amount: amt,
                        date: dateStr,
                        payment_mode: clientTxnMode,
                        notes: clientTxnNotes.trim(),
                    };
                }
                return t;
            });
            await saveTxnsToStorage(updatedTxns);
            setEditingClientTxn(null);
            setClientTxnAmount('');
            setClientTxnNotes('');
            setIsClientTxnModalVisible(false);
            Alert.alert('Updated', 'Transaction updated successfully.');
            return;
        }

        const createPayload = {
            client_id: selectedClientForTxn.id,
            txn_type: clientTxnType,
            amount: amt,
            date: dateStr,
            payment_mode: clientTxnMode,
            notes: clientTxnNotes.trim() || null,
        };

        let newTxn = {
            id: Date.now(),
            client_id: selectedClientForTxn.id,
            type: clientTxnType,
            txn_type: clientTxnType,
            amount: amt,
            date: dateStr,
            payment_mode: clientTxnMode,
            notes: clientTxnNotes.trim(),
            created_at: new Date().toISOString()
        };

        try {
            if (userToken && isOnline) {
                const res = await fetch(`${API_BASE_URL}/clients/transactions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${userToken}`
                    },
                    body: JSON.stringify(createPayload)
                });
                if (res.ok) {
                    const serverTxn = await res.json();
                    newTxn = { ...serverTxn, type: serverTxn.txn_type };
                }
            }
        } catch (err) {
            console.log('Cloud txn create error:', err);
        }

        const updatedTxns = [newTxn, ...clientTransactions];
        await saveTxnsToStorage(updatedTxns);

        if (syncClientTxnToDaily && (clientTxnType === 'RECEIVED' || clientTxnType === 'ADVANCE')) {
            const dailyPayload = {
                transaction_type: 'INCOME',
                category: 'CLIENT_PAYMENT',
                amount: amt,
                description: 'Payment from ' + selectedClientForTxn.name + ' (' + clientTxnMode + ')' + (clientTxnNotes ? ': ' + clientTxnNotes : ''),
                date: dateStr,
                site_id: selectedSite?.id || 1
            };
            try {
                if (isOnline) {
                    await fetch(API_BASE_URL + '/workforce/daily-ledger', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + userToken
                        },
                        body: JSON.stringify(dailyPayload)
                    });
                    fetchLedger();
                } else {
                    await saveRequestOffline('/workforce/daily-ledger', 'POST', dailyPayload);
                }
            } catch (e) {
                await saveRequestOffline('/workforce/daily-ledger', 'POST', dailyPayload);
            }
        }

        setClientTxnAmount('');
        setClientTxnNotes('');
        setIsClientTxnModalVisible(false);
        Alert.alert('Recorded', 'Transaction of ₹' + amt.toLocaleString() + ' recorded for ' + selectedClientForTxn.name + '.');
    };

    const handleDeleteClientTxn = (txnId) => {
        Alert.alert('Delete Entry', 'Are you sure you want to delete this transaction?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        if (userToken && isOnline) {
                            await fetch(`${API_BASE_URL}/clients/transactions/${txnId}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${userToken}` }
                            });
                        }
                    } catch (err) {
                        console.log('Cloud txn delete error:', err);
                    }
                    const updated = clientTransactions.filter(t => t.id !== txnId);
                    await saveTxnsToStorage(updated);
                }
            }
        ]);
    };

    const getClientMetrics = (clientId, openingBal = 0) => {
        const txns = clientTransactions.filter(t => String(t.client_id) === String(clientId));
        const billed = txns.filter(t => t.type === 'BILLED' || t.txn_type === 'BILLED').reduce((s, t) => s + (t.amount || 0), 0) + (parseFloat(openingBal) || 0);
        const received = txns.filter(t => t.type === 'RECEIVED' || t.txn_type === 'RECEIVED' || t.type === 'ADVANCE' || t.txn_type === 'ADVANCE').reduce((s, t) => s + (t.amount || 0), 0);
        const pending = billed - received;
        return { billed, received, pending, txnsCount: txns.length };
    };

    const clientStats = clients.reduce((acc, c) => {
        const m = getClientMetrics(c.id, c.opening_balance);
        if (m.pending > 0) {
            acc.totalReceivable += m.pending;
            acc.dueCount += 1;
        } else if (m.pending < 0) {
            acc.totalAdvance += Math.abs(m.pending);
            acc.advanceCount += 1;
        } else {
            acc.settledCount += 1;
        }
        return acc;
    }, { totalReceivable: 0, totalAdvance: 0, dueCount: 0, advanceCount: 0, settledCount: 0 });

    const totalClientsPending = clientStats.totalReceivable;

    // Helper to format date range for Khatabahi Report (e.g. 01 OCT 26)
    const formatKhatabahiRange = (date) => {
        if (!date) return '';
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const year = String(d.getFullYear()).slice(-2);
        return `${day} ${month} ${year}`;
    };

    const formatRowDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = d.toLocaleString('en-US', { month: 'short' });
        return `${day} ${month}`;
    };

    // Calculate aggregated Date-Wise Khatabahi data matching khatabahi.jpeg
    const getReportData = () => {
        const start = new Date(reportStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(reportEndDate);
        end.setHours(23, 59, 59, 999);

        const txns = clientTransactions.filter(t => {
            if (reportPartyFilter !== 'ALL' && String(t.client_id) !== String(reportPartyFilter)) return false;
            if (!t.date) return false;
            const d = new Date(t.date);
            return d >= start && d <= end;
        });

        let totalIn = 0;  // RECEIVED / ADVANCE
        let totalOut = 0; // BILLED

        const dateMap = {};

        txns.forEach(t => {
            const dateStr = t.date;
            const type = t.type || t.txn_type || 'BILLED';
            const amt = parseFloat(t.amount) || 0;
            const isIn = type === 'RECEIVED' || type === 'ADVANCE';
            const isOut = type === 'BILLED';

            if (isIn) totalIn += amt;
            if (isOut) totalOut += amt;

            if (!dateMap[dateStr]) {
                dateMap[dateStr] = {
                    date: dateStr,
                    totalIn: 0,
                    totalOut: 0,
                    balance: 0,
                    transactions: []
                };
            }
            if (isIn) dateMap[dateStr].totalIn += amt;
            if (isOut) dateMap[dateStr].totalOut += amt;
            dateMap[dateStr].transactions.push(t);
        });

        const sortedDates = Object.keys(dateMap).sort((a, b) => new Date(b) - new Date(a)).map(d => {
            const item = dateMap[d];
            item.balance = item.totalIn - item.totalOut;
            return item;
        });

        return {
            totalIn,
            totalOut,
            netBalance: totalIn - totalOut,
            days: sortedDates,
            totalTxns: txns.length
        };
    };

    // HTML Generator for Client Passbook or Date-Wise Report
    const generateStatementHtml = (target) => {
        if (!target) return '';
        const currentDateStr = new Date().toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });

        if (target.type === 'CLIENT_STATEMENT') {
            const client = target.client;
            const metrics = getClientMetrics(client.id, client.opening_balance);
            const txns = clientTransactions
                .filter(t => String(t.client_id) === String(client.id))
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            let runningBal = parseFloat(client.opening_balance) || 0;
            let rowsHtml = '';

            if (client.opening_balance && parseFloat(client.opening_balance) !== 0) {
                rowsHtml += `
                    <tr style="background: #F8FAFC; font-weight: 600;">
                        <td>-</td>
                        <td><strong>Opening Balance</strong></td>
                        <td>-</td>
                        <td style="color: #475569;">INITIAL</td>
                        <td style="text-align: right; color: #DC2626;">₹${parseFloat(client.opening_balance).toLocaleString('en-IN')}</td>
                        <td style="text-align: right; color: #64748B;">-</td>
                        <td style="text-align: right; font-weight: 700; color: #DC2626;">₹${runningBal.toLocaleString('en-IN')}</td>
                    </tr>
                `;
            }

            txns.forEach((t) => {
                const type = t.type || t.txn_type || 'BILLED';
                const isDebit = type === 'BILLED';
                const amt = parseFloat(t.amount) || 0;
                const debitAmt = isDebit ? amt : 0;
                const creditAmt = !isDebit ? amt : 0;
                runningBal += (debitAmt - creditAmt);

                rowsHtml += `
                    <tr>
                        <td style="white-space: nowrap;">${t.date || '-'}</td>
                        <td>${t.notes || (isDebit ? 'Material / Freight Billed' : 'Payment Received')}</td>
                        <td><span class="mode-tag">${t.payment_mode || 'CASH'}</span></td>
                        <td><span class="${isDebit ? 'badge-debit' : 'badge-credit'}">${type}</span></td>
                        <td style="text-align: right; color: #DC2626;">${debitAmt > 0 ? '₹' + debitAmt.toLocaleString('en-IN') : '-'}</td>
                        <td style="text-align: right; color: #16A34A;">${creditAmt > 0 ? '₹' + creditAmt.toLocaleString('en-IN') : '-'}</td>
                        <td style="text-align: right; font-weight: 700; color: ${runningBal > 0 ? '#DC2626' : runningBal < 0 ? '#16A34A' : '#475569'};">
                            ₹${Math.abs(runningBal).toLocaleString('en-IN')} ${runningBal > 0 ? 'Dr (Due)' : runningBal < 0 ? 'Cr (Adv)' : ''}
                        </td>
                    </tr>
                `;
            });

            if (!rowsHtml) {
                rowsHtml = `<tr><td colspan="7" style="text-align: center; color: #94A3B8; padding: 24px;">No transactions recorded for this client yet.</td></tr>`;
            }

            const netStatusText = metrics.pending > 0 
                ? `₹${metrics.pending.toLocaleString('en-IN')} (LENA HAI / DUE)` 
                : metrics.pending < 0 
                ? `₹${Math.abs(metrics.pending).toLocaleString('en-IN')} (ADVANCE HELD)` 
                : '₹0 (SETTLED)';
            const netStatusColor = metrics.pending > 0 ? '#DC2626' : metrics.pending < 0 ? '#16A34A' : '#475569';

            return `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Client Statement - ${client.name}</title>
                    <style>
                        @page { size: A4 portrait; margin: 12mm; }
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 16px; color: #0F172A; background: #fff; line-height: 1.4; }
                        .header-box { border-bottom: 3px solid #0F172A; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
                        .company-name { font-size: 22px; font-weight: 900; color: #0F172A; letter-spacing: 0.5px; }
                        .company-tag { font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase; margin-top: 2px; }
                        .doc-title { text-align: right; }
                        .doc-title h2 { margin: 0; font-size: 16px; font-weight: 800; color: #2563EB; }
                        .doc-title span { font-size: 11px; color: #64748B; }

                        .client-hero { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; margin-bottom: 16px; display: flex; justify-content: space-between; gap: 16px; }
                        .client-info h3 { margin: 0 0 4px 0; font-size: 18px; font-weight: 800; color: #0F172A; }
                        .client-info p { margin: 2px 0; font-size: 12px; color: #475569; }
                        
                        .balance-box { background: #FFFFFF; border: 2px solid ${netStatusColor}; border-radius: 8px; padding: 10px 14px; text-align: right; min-width: 180px; }
                        .bal-label { font-size: 10px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; }
                        .bal-val { font-size: 17px; font-weight: 900; color: ${netStatusColor}; margin-top: 2px; }

                        .summary-grid { display: flex; gap: 12px; margin-bottom: 16px; }
                        .summary-card { flex: 1; background: #F1F5F9; border-radius: 8px; padding: 10px 14px; }
                        .sc-label { font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; }
                        .sc-val { font-size: 15px; font-weight: 800; margin-top: 3px; color: #0F172A; }

                        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
                        th { background: #0F172A; color: #FFFFFF; text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
                        td { padding: 8px 10px; border-bottom: 1px solid #E2E8F0; }
                        .badge-debit { background: #FEE2E2; color: #DC2626; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
                        .badge-credit { background: #DCFCE7; color: #16A34A; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
                        .mode-tag { background: #F1F5F9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }

                        .sign-box { margin-top: 26px; text-align: right; }
                        .sign-line { display: inline-block; width: 160px; border-bottom: 1px solid #000; margin-bottom: 4px; }
                        .footer-note { margin-top: 20px; border-top: 1px dashed #CBD5E1; padding-top: 10px; display: flex; justify-content: space-between; font-size: 11px; color: #94A3B8; }
                    </style>
                </head>
                <body>
                    <div class="header-box">
                        <div>
                            <div class="company-name">GOPAL AGRAWAL ENTERPRISES</div>
                            <div class="company-tag">Fleet Transport, Logistics & Material Supply Khata</div>
                        </div>
                        <div class="doc-title">
                            <h2>KHATABOOK STATEMENT</h2>
                            <span>Date: ${currentDateStr}</span>
                        </div>
                    </div>

                    <div class="client-hero">
                        <div class="client-info">
                            <h3>${client.name}</h3>
                            <p><strong>Phone:</strong> ${client.phone ? client.phone : 'Not Specified'}</p>
                            <p><strong>Address:</strong> ${client.address ? client.address : 'Depot / Site Address'}</p>
                        </div>
                        <div class="balance-box">
                            <div class="bal-label">NET BALANCE POSITION</div>
                            <div class="bal-val">${netStatusText}</div>
                        </div>
                    </div>

                    <div class="summary-grid">
                        <div class="summary-card">
                            <div class="sc-label">Total Billed (You Gave)</div>
                            <div class="sc-val" style="color: #DC2626;">₹${metrics.billed.toLocaleString('en-IN')}</div>
                        </div>
                        <div class="summary-card">
                            <div class="sc-label">Total Received (You Got)</div>
                            <div class="sc-val" style="color: #16A34A;">₹${metrics.received.toLocaleString('en-IN')}</div>
                        </div>
                        <div class="summary-card">
                            <div class="sc-label">Total Entries</div>
                            <div class="sc-val">${metrics.txnsCount} Transactions</div>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Description / Particulars</th>
                                <th>Mode</th>
                                <th>Type</th>
                                <th style="text-align: right;">Billed (₹)</th>
                                <th style="text-align: right;">Received (₹)</th>
                                <th style="text-align: right;">Balance (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>

                    <div class="sign-box">
                        <div class="sign-line"></div>
                        <div style="font-size: 12px; font-weight: 700;">Authorized Signatory</div>
                        <div style="font-size: 11px; color: #64748B;">Gopal Agrawal Enterprises</div>
                    </div>

                    <div class="footer-note">
                        <div>Computer Generated Statement via Fleet Khata System</div>
                        <div>Generated: ${new Date().toLocaleString('en-IN')}</div>
                    </div>
                </body>
                </html>
            `;
        }

        if (target.type === 'DATE_REPORT') {
            const reportData = getReportData();
            const startStr = formatKhatabahiRange(reportStartDate);
            const endStr = formatKhatabahiRange(reportEndDate);
            const partyLabel = target.partyName || 'All Clients';

            let rowsHtml = '';
            reportData.days.forEach(d => {
                const rowDateFormatted = formatRowDate(d.date);
                rowsHtml += `
                    <tr style="background: #F8FAFC; font-weight: 700;">
                        <td><strong>${rowDateFormatted}</strong> (${d.date})</td>
                        <td style="text-align: right; color: #16A34A;">₹${d.totalIn.toLocaleString('en-IN')}</td>
                        <td style="text-align: right; color: #DC2626;">₹${d.totalOut.toLocaleString('en-IN')}</td>
                        <td style="text-align: right; color: ${d.balance >= 0 ? '#1D4ED8' : '#DC2626'}; font-weight: 800;">₹${d.balance.toLocaleString('en-IN')}</td>
                    </tr>
                `;
                d.transactions.forEach(t => {
                    const c = clients.find(cl => String(cl.id) === String(t.client_id));
                    const tType = t.type || t.txn_type || 'BILLED';
                    const isDebit = tType === 'BILLED';
                    rowsHtml += `
                        <tr style="font-size: 11px; color: #475569;">
                            <td style="padding-left: 20px;">↳ ${c ? c.name : 'Client #' + t.client_id} <span style="font-size: 10px; color: #94A3B8;">(${t.notes || t.payment_mode || 'Cash'})</span></td>
                            <td style="text-align: right; color: #16A34A;">${!isDebit ? '₹' + parseFloat(t.amount).toLocaleString('en-IN') : '-'}</td>
                            <td style="text-align: right; color: #DC2626;">${isDebit ? '₹' + parseFloat(t.amount).toLocaleString('en-IN') : '-'}</td>
                            <td style="text-align: right; font-size: 10px; color: #64748B;">${tType}</td>
                        </tr>
                    `;
                });
            });

            if (!rowsHtml) {
                rowsHtml = `<tr><td colspan="4" style="text-align: center; color: #94A3B8; padding: 24px;">No transactions found in this date range.</td></tr>`;
            }

            return `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Khatabahi Date-Wise Report (${startStr} - ${endStr})</title>
                    <style>
                        @page { size: A4 portrait; margin: 12mm; }
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 16px; color: #0F172A; background: #fff; line-height: 1.4; }
                        .header-box { border-bottom: 3px solid #1E40AF; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
                        .company-name { font-size: 22px; font-weight: 900; color: #1E40AF; letter-spacing: 0.5px; }
                        .company-tag { font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase; margin-top: 2px; }
                        .doc-title { text-align: right; }
                        .doc-title h2 { margin: 0; font-size: 16px; font-weight: 800; color: #0F172A; }
                        .doc-title span { font-size: 11px; color: #64748B; }

                        .equation-hero { background: #EFF6FF; border: 1.5px solid #BFDBFE; border-radius: 10px; padding: 16px; margin-bottom: 20px; display: flex; justify-content: space-around; align-items: center; text-align: center; }
                        .eq-col { flex: 1; }
                        .eq-label { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; margin-bottom: 4px; }
                        .eq-val-in { font-size: 20px; font-weight: 900; color: #16A34A; }
                        .eq-val-out { font-size: 20px; font-weight: 900; color: #DC2626; }
                        .eq-val-net { font-size: 20px; font-weight: 900; color: #1D4ED8; }
                        .eq-op { font-size: 24px; font-weight: 800; color: #64748B; padding: 0 8px; }

                        .filter-info { font-size: 12px; color: #475569; margin-bottom: 14px; background: #F8FAFC; padding: 8px 12px; border-radius: 6px; border: 1px solid #E2E8F0; }

                        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
                        th { background: #1E40AF; color: #FFFFFF; text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
                        td { padding: 8px 10px; border-bottom: 1px solid #E2E8F0; }

                        .sign-box { margin-top: 26px; text-align: right; }
                        .sign-line { display: inline-block; width: 160px; border-bottom: 1px solid #000; margin-bottom: 4px; }
                        .footer-note { margin-top: 20px; border-top: 1px dashed #CBD5E1; padding-top: 10px; display: flex; justify-content: space-between; font-size: 11px; color: #94A3B8; }
                    </style>
                </head>
                <body>
                    <div class="header-box">
                        <div>
                            <div class="company-name">GOPAL AGRAWAL ENTERPRISES</div>
                            <div class="company-tag">Daily Ledger & Khatabahi Report</div>
                        </div>
                        <div class="doc-title">
                            <h2>DATE-WISE REPORT</h2>
                            <span>Period: ${startStr} — ${endStr}</span>
                        </div>
                    </div>

                    <div class="filter-info">
                        <strong>Report Period:</strong> ${startStr} to ${endStr} &nbsp;|&nbsp; <strong>Client Filter:</strong> ${partyLabel} &nbsp;|&nbsp; <strong>Total Entries:</strong> ${reportData.totalTxns}
                    </div>

                    <div class="equation-hero">
                        <div class="eq-col">
                            <div class="eq-label">Total In (Received)</div>
                            <div class="eq-val-in">₹${reportData.totalIn.toLocaleString('en-IN')}</div>
                        </div>
                        <div class="eq-op">—</div>
                        <div class="eq-col">
                            <div class="eq-label">Total Out (Billed)</div>
                            <div class="eq-val-out">₹${reportData.totalOut.toLocaleString('en-IN')}</div>
                        </div>
                        <div class="eq-op">=</div>
                        <div class="eq-col">
                            <div class="eq-label">Net Balance</div>
                            <div class="eq-val-net">₹${reportData.netBalance.toLocaleString('en-IN')}</div>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Date / Entry Particulars</th>
                                <th style="text-align: right;">Total In (₹)</th>
                                <th style="text-align: right;">Total Out (₹)</th>
                                <th style="text-align: right;">Balance (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>

                    <div class="sign-box">
                        <div class="sign-line"></div>
                        <div style="font-size: 12px; font-weight: 700;">Authorized Signatory</div>
                        <div style="font-size: 11px; color: #64748B;">Gopal Agrawal Enterprises</div>
                    </div>

                    <div class="footer-note">
                        <div>Computer Generated Khatabahi Daily Ledger Report</div>
                        <div>Generated: ${new Date().toLocaleString('en-IN')}</div>
                    </div>
                </body>
                </html>
            `;
        }
        return '';
    };

    // Vector SVG Graphic Generator for "Save as Image" option
    const generateStatementSvg = (target) => {
        const isReport = target.type === 'DATE_REPORT';
        const title = isReport 
            ? `Khatabahi Date-Wise Report` 
            : `Statement - ${(target.client?.name || 'Client')}`;
        const dateRange = isReport
            ? `${formatKhatabahiRange(reportStartDate)} - ${formatKhatabahiRange(reportEndDate)}`
            : new Date().toLocaleDateString('en-IN');

        let inVal = 0;
        let outVal = 0;
        let netVal = 0;

        if (isReport) {
            const d = getReportData();
            inVal = d.totalIn;
            outVal = d.totalOut;
            netVal = d.netBalance;
        } else {
            const m = getClientMetrics(target.client.id, target.client.opening_balance);
            inVal = m.received;
            outVal = m.billed;
            netVal = m.pending;
        }

        return `
            <svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480">
                <rect width="100%" height="100%" fill="#F8FAFC"/>
                <rect width="100%" height="70" fill="#1E40AF"/>
                <text x="30" y="38" fill="#FFFFFF" font-family="sans-serif" font-size="20" font-weight="bold">GOPAL AGRAWAL ENTERPRISES</text>
                <text x="30" y="56" fill="#93C5FD" font-family="sans-serif" font-size="11" font-weight="bold">FLEET TRANSPORT &amp; KHATABOOK SYSTEM</text>
                <text x="770" y="42" fill="#FFFFFF" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="end">${dateRange}</text>

                <rect x="30" y="90" width="740" height="85" rx="10" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
                <text x="50" y="125" fill="#0F172A" font-family="sans-serif" font-size="18" font-weight="bold">${title}</text>
                <text x="50" y="152" fill="#64748B" font-family="sans-serif" font-size="12">Official Account Record &amp; Financial Position</text>

                <rect x="30" y="195" width="230" height="120" rx="10" fill="#ECFDF5" stroke="#A7F3D0" stroke-width="1"/>
                <text x="50" y="230" fill="#065F46" font-family="sans-serif" font-size="12" font-weight="bold">TOTAL IN (RECEIVED)</text>
                <text x="50" y="270" fill="#047857" font-family="sans-serif" font-size="22" font-weight="900">₹${inVal.toLocaleString('en-IN')}</text>

                <rect x="285" y="195" width="230" height="120" rx="10" fill="#FEF2F2" stroke="#FECACA" stroke-width="1"/>
                <text x="305" y="230" fill="#991B1B" font-family="sans-serif" font-size="12" font-weight="bold">TOTAL OUT (BILLED)</text>
                <text x="305" y="270" fill="#B91C1C" font-family="sans-serif" font-size="22" font-weight="900">₹${outVal.toLocaleString('en-IN')}</text>

                <rect x="540" y="195" width="230" height="120" rx="10" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1"/>
                <text x="560" y="230" fill="#1E40AF" font-family="sans-serif" font-size="12" font-weight="bold">NET POSITION</text>
                <text x="560" y="270" fill="#1D4ED8" font-family="sans-serif" font-size="22" font-weight="900">₹${Math.abs(netVal).toLocaleString('en-IN')}</text>
                <text x="560" y="295" fill="#64748B" font-family="sans-serif" font-size="11">${netVal >= 0 ? '(Due / Receivable)' : '(Advance Held)'}</text>

                <line x1="30" y1="410" x2="770" y2="410" stroke="#CBD5E1" stroke-width="1" stroke-dasharray="4"/>
                <text x="30" y="440" fill="#94A3B8" font-family="sans-serif" font-size="11">Generated on ${new Date().toLocaleString('en-IN')} • Fleet Management App</text>
                <text x="770" y="440" fill="#0F172A" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="end">Authorized Signatory</text>
            </svg>
        `;
    };

    const openExportModal = (target) => {
        setExportTarget(target);
        setIsExportModalVisible(true);
    };

    const exportClientPdf = (client) => {
        openExportModal({
            type: 'CLIENT_STATEMENT',
            client: client
        });
    };

    const handleExportAction = async (actionType) => {
        if (!exportTarget) return;
        try {
            setIsExporting(true);
            const html = generateStatementHtml(exportTarget);
            const title = exportTarget.type === 'DATE_REPORT' 
                ? 'Khatabahi_Report' 
                : `Statement_${(exportTarget.client?.name || 'Client').replace(/[^a-zA-Z0-9]/g, '_')}`;

            if (actionType === 'PRINT_A4') {
                await Print.printAsync({ html });
                setIsExportModalVisible(false);
                return;
            }

            if (actionType === 'SAVE_PDF' || actionType === 'WHATSAPP') {
                const { uri: tempUri } = await Print.printToFileAsync({ html });
                const fileName = `${title}_${Date.now()}.pdf`;
                const destUri = `${FileSystem.documentDirectory}${fileName}`;
                await FileSystem.copyAsync({ from: tempUri, to: destUri });

                if (actionType === 'SAVE_PDF') {
                    await Sharing.shareAsync(destUri, {
                        mimeType: 'application/pdf',
                        dialogTitle: 'Save / Download PDF Statement'
                    });
                } else if (actionType === 'WHATSAPP') {
                    await Sharing.shareAsync(destUri, {
                        mimeType: 'application/pdf',
                        dialogTitle: 'Share PDF Statement via WhatsApp'
                    });
                }
                setIsExportModalVisible(false);
                return;
            }

            if (actionType === 'SAVE_IMAGE') {
                const svgContent = generateStatementSvg(exportTarget);
                const fileName = `${title}_${Date.now()}.svg`;
                const imageUri = `${FileSystem.documentDirectory}${fileName}`;
                await FileSystem.writeAsStringAsync(imageUri, svgContent);
                await Sharing.shareAsync(imageUri, {
                    mimeType: 'image/svg+xml',
                    dialogTitle: 'Save / Share Statement Image'
                });
                setIsExportModalVisible(false);
                return;
            }
        } catch (err) {
            console.error('Export error:', err);
            Alert.alert('Export Error', err.message || 'Failed to complete export action.');
        } finally {
            setIsExporting(false);
        }
    };
    
    // Active View: Cashflow vs Client Khata vs Date Report vs Freight Ledger
    const filteredClients = clients.filter(c => {
        const m = getClientMetrics(c.id, c.opening_balance);
        if (clientKhataFilter === 'DUE' && m.pending <= 0) return false;
        if (clientKhataFilter === 'ADVANCE' && m.pending >= 0) return false;
        if (clientKhataFilter === 'SETTLED' && m.pending !== 0) return false;
        if (!clientSearchText.trim()) return true;
        const q = clientSearchText.toLowerCase();
        return (c.name && c.name.toLowerCase().includes(q)) || (c.phone && c.phone.includes(q));
    });

    const [activeView, setActiveView] = useState('CASHFLOW'); // 'CASHFLOW', 'CLIENTS', 'REPORTS', 'FREIGHT'
    const [freightData, setFreightData] = useState({
        summary: {
            total_freight_billed: 0,
            total_freight_received: 0,
            total_freight_pending: 0,
            collection_percentage: 0,
            total_trips: 0
        },
        trips: []
    });
    const [freightLoading, setFreightLoading] = useState(false);
    const [freightStatusFilter, setFreightStatusFilter] = useState('ALL');
    const [selectedTripForPayment, setSelectedTripForPayment] = useState(null);
    const [freightPaymentAmount, setFreightPaymentAmount] = useState('');
    const [freightPaymentMode, setFreightPaymentMode] = useState('CASH');
    const [freightPaymentNotes, setFreightPaymentNotes] = useState('');

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
        fetchFreightLedger();
    }, [selectedDate, filterMode, selectedSite?.id, freightStatusFilter]);

    const fetchStaff = async () => {
        try {
            const resp = await fetch(`${API_BASE_URL}/auth/users`, {
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

    const fetchFreightLedger = async () => {
        setFreightLoading(true);
        try {
            let url = `${API_BASE_URL}/trips/freight-ledger?`;
            if (selectedSite?.id) url += `site_id=${selectedSite.id}&`;
            if (freightStatusFilter !== 'ALL') url += `status=${freightStatusFilter}&`;

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${userToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                setFreightData(data);
            }
        } catch (e) {
            console.log("Error fetching freight ledger:", e);
        } finally {
            setFreightLoading(false);
        }
    };

    const handleRecordFreightPayment = async () => {
        if (!freightPaymentAmount || parseFloat(freightPaymentAmount) <= 0) {
            Alert.alert("Required", "Please enter a valid payment amount");
            return;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/trips/${selectedTripForPayment.id}/record-freight-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({
                    amount_paid: parseFloat(freightPaymentAmount),
                    payment_mode: freightPaymentMode,
                    notes: freightPaymentNotes.trim()
                })
            });
            if (res.ok) {
                Alert.alert("Payment Recorded", `₹${freightPaymentAmount} recorded & credited to daily ledger!`);
                setSelectedTripForPayment(null);
                setFreightPaymentAmount('');
                setFreightPaymentNotes('');
                fetchFreightLedger();
                fetchLedger();
            } else {
                Alert.alert("Error", "Failed to record payment");
            }
        } catch (e) {
            Alert.alert("Error", "Network error recording payment");
        }
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
        setSelectedClientForTxn(null);
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

    const insets = useSafeAreaInsets();
    const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 36 : 20);

    return (
        <View style={[styles.container, { paddingTop: topPadding }]}>
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

            {/* Top View Selector: Daily Cashflow vs Freight Ledger */}
            <View style={{ backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topSegmentContainer}>
                <TouchableOpacity
                    style={[styles.topSegmentBtn, activeView === 'CASHFLOW' && styles.topSegmentBtnActive]}
                    onPress={() => setActiveView('CASHFLOW')}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="cash-multiple" size={16} color={activeView === 'CASHFLOW' ? '#2563EB' : '#64748B'} />
                    <Text style={[styles.topSegmentText, activeView === 'CASHFLOW' && styles.topSegmentTextActive]}>Daily Cashflow</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.topSegmentBtn, activeView === 'CLIENTS' && styles.topSegmentBtnActive]}
                    onPress={() => setActiveView('CLIENTS')}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="account-cash" size={16} color={activeView === 'CLIENTS' ? '#2563EB' : '#64748B'} />
                    <Text style={[styles.topSegmentText, activeView === 'CLIENTS' && styles.topSegmentTextActive]}>Client Khata</Text>
                    {totalClientsPending > 0 && (
                        <View style={[styles.miniPendingPill, { backgroundColor: '#FEE2E2' }]}>
                            <Text style={[styles.miniPendingPillText, { color: '#DC2626' }]}>₹{Math.round(totalClientsPending).toLocaleString()}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.topSegmentBtn, activeView === 'REPORTS' && styles.topSegmentBtnActive]}
                    onPress={() => setActiveView('REPORTS')}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="chart-box-outline" size={16} color={activeView === 'REPORTS' ? '#2563EB' : '#64748B'} />
                    <Text style={[styles.topSegmentText, activeView === 'REPORTS' && styles.topSegmentTextActive]}>Date Report</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.topSegmentBtn, activeView === 'FREIGHT' && styles.topSegmentBtnActive]}
                    onPress={() => { setActiveView('FREIGHT'); fetchFreightLedger(); }}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="truck-delivery" size={16} color={activeView === 'FREIGHT' ? '#2563EB' : '#64748B'} />
                    <Text style={[styles.topSegmentText, activeView === 'FREIGHT' && styles.topSegmentTextActive]}>Freight Ledger</Text>
                    {freightData.summary.total_freight_pending > 0 && (
                        <View style={styles.miniPendingPill}>
                            <Text style={styles.miniPendingPillText}>₹{Math.round(freightData.summary.total_freight_pending).toLocaleString()}</Text>
                        </View>
                    )}
                </TouchableOpacity>
                </ScrollView>
            </View>

            {activeView === 'CASHFLOW' ? (
                <>
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
                                        <Text style={styles.transCategory} numberOfLines={1}>{item.category?.replace(/_/g, ' ')}</Text>
                                        <Text style={[styles.transAmount, { color: isIncome ? '#059669' : '#DC2626' }]} numberOfLines={1} adjustsFontSizeToFit>
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
                </>
            ) : activeView === 'CLIENTS' ? (
                <View style={{ flex: 1 }}>
                    {/* Client Search and Add Header */}
                    <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 10, height: 40 }}>
                                <MaterialCommunityIcons name="magnify" size={18} color="#64748B" style={{ marginRight: 6 }} />
                                <TextInput 
                                    style={{ flex: 1, fontSize: 13, color: '#0F172A' }}
                                    placeholder="Search saved clients by name/phone..."
                                    placeholderTextColor="#94A3B8"
                                    value={clientSearchText}
                                    onChangeText={setClientSearchText}
                                />
                                {clientSearchText ? (
                                    <TouchableOpacity onPress={() => setClientSearchText('')}>
                                        <MaterialCommunityIcons name="close-circle" size={16} color="#94A3B8" />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                            <TouchableOpacity 
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1E40AF', paddingHorizontal: 12, height: 40, borderRadius: 10 }}
                                onPress={() => setActiveView('REPORTS')}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="calendar-text-outline" size={16} color="#FFFFFF" />
                                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Report</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F172A', paddingHorizontal: 14, height: 40, borderRadius: 10 }}
                                onPress={() => setIsAddClientModalVisible(true)}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="account-plus" size={16} color="#FFFFFF" />
                                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>+ Add</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView 
                        ref={clientScrollViewRef}
                        style={styles.content} 
                        contentContainerStyle={styles.scrollContent} 
                        showsVerticalScrollIndicator={false}
                        onScroll={(e) => {
                            clientScrollYRef.current = e.nativeEvent.contentOffset.y;
                        }}
                        scrollEventThrottle={16}
                    >
                        {/* Top Executive Stats Block with Clickable Filters */}
                        <View style={styles.clientStatsBlock}>
                            <View style={styles.clientStatsDualRow}>
                                {/* Receivable Card - Clickable Filter */}
                                <TouchableOpacity 
                                    style={[
                                        styles.clientStatsCard, 
                                        { borderLeftColor: '#EF4444' },
                                        clientKhataFilter === 'DUE' && styles.clientStatsCardActiveDue
                                    ]}
                                    onPress={() => setClientKhataFilter(prev => prev === 'DUE' ? 'ALL' : 'DUE')}
                                    activeOpacity={0.8}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Text style={styles.clientStatsCardLabel}>TOTAL RECEIVABLE</Text>
                                        <View style={[styles.statIconBadge, { backgroundColor: clientKhataFilter === 'DUE' ? '#DC2626' : '#FEE2E2' }]}>
                                            <MaterialCommunityIcons name="arrow-down-left" size={14} color={clientKhataFilter === 'DUE' ? '#FFFFFF' : '#DC2626'} />
                                        </View>
                                    </View>
                                    <Text style={styles.clientStatsHindiLabel}>मार्केट से लेना बाकी</Text>
                                    <Text style={[styles.clientStatsCardVal, { color: '#DC2626' }]} numberOfLines={1}>
                                        ₹{Math.round(clientStats.totalReceivable).toLocaleString()}
                                    </Text>
                                    <Text style={styles.clientStatsCardSub}>{clientStats.dueCount} parties with pending dues</Text>
                                    {clientKhataFilter === 'DUE' && (
                                        <View style={styles.statActiveBadge}>
                                            <Text style={styles.statActiveBadgeText}>FILTER ACTIVE (TAP TO RESET)</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                {/* Customer Advance Card - Clickable Filter */}
                                <TouchableOpacity 
                                    style={[
                                        styles.clientStatsCard, 
                                        { borderLeftColor: '#10B981' },
                                        clientKhataFilter === 'ADVANCE' && styles.clientStatsCardActiveAdv
                                    ]}
                                    onPress={() => setClientKhataFilter(prev => prev === 'ADVANCE' ? 'ALL' : 'ADVANCE')}
                                    activeOpacity={0.8}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Text style={styles.clientStatsCardLabel}>CUSTOMER ADVANCE</Text>
                                        <View style={[styles.statIconBadge, { backgroundColor: clientKhataFilter === 'ADVANCE' ? '#16A34A' : '#DCFCE7' }]}>
                                            <MaterialCommunityIcons name="hand-coin" size={14} color={clientKhataFilter === 'ADVANCE' ? '#FFFFFF' : '#16A34A'} />
                                        </View>
                                    </View>
                                    <Text style={styles.clientStatsHindiLabel}>अग्रिम प्राप्त / जमा</Text>
                                    <Text style={[styles.clientStatsCardVal, { color: '#059669' }]} numberOfLines={1}>
                                        ₹{Math.round(clientStats.totalAdvance).toLocaleString()}
                                    </Text>
                                    <Text style={styles.clientStatsCardSub}>{clientStats.advanceCount} parties in credit advance</Text>
                                    {clientKhataFilter === 'ADVANCE' && (
                                        <View style={[styles.statActiveBadge, { backgroundColor: '#10B981' }]}>
                                            <Text style={styles.statActiveBadgeText}>FILTER ACTIVE (TAP TO RESET)</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Net Summary Bar - Clickable Filter */}
                            <TouchableOpacity 
                                style={[
                                    styles.clientNetBar,
                                    clientKhataFilter === 'SETTLED' && styles.clientNetBarActive
                                ]}
                                onPress={() => setClientKhataFilter(prev => prev === 'SETTLED' ? 'ALL' : 'SETTLED')}
                                activeOpacity={0.8}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                    <MaterialCommunityIcons name="scale-balance" size={15} color={clientKhataFilter === 'SETTLED' ? '#2563EB' : '#64748B'} />
                                    <Text style={styles.clientNetBarText} numberOfLines={1}>
                                        Net: <Text style={{ fontWeight: '900', color: (clientStats.totalReceivable - clientStats.totalAdvance) >= 0 ? '#DC2626' : '#16A34A' }}>
                                            ₹{Math.abs(clientStats.totalReceivable - clientStats.totalAdvance).toLocaleString()} {(clientStats.totalReceivable - clientStats.totalAdvance) >= 0 ? 'Receivable' : 'Advance'}
                                        </Text>
                                    </Text>
                                </View>
                                <Text style={[styles.clientNetBarRight, clientKhataFilter === 'SETTLED' && { color: '#2563EB', fontWeight: '900' }]}>
                                    {clients.length} Clients ({clientStats.settledCount} Settled {clientKhataFilter === 'SETTLED' ? '✓' : ''})
                                </Text>
                            </TouchableOpacity>

                            {/* Quick Filter Chips Row */}
                            <View style={styles.clientFilterChipsRow}>
                                <TouchableOpacity 
                                    style={[styles.clientFilterChip, clientKhataFilter === 'ALL' && styles.clientFilterChipActive]}
                                    onPress={() => setClientKhataFilter('ALL')}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.clientFilterChipText, clientKhataFilter === 'ALL' && styles.clientFilterChipTextActive]}>
                                        All ({clients.length})
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.clientFilterChip, clientKhataFilter === 'DUE' && styles.clientFilterChipActiveDue]}
                                    onPress={() => setClientKhataFilter('DUE')}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.clientFilterChipText, clientKhataFilter === 'DUE' && styles.clientFilterChipTextActiveDue]}>
                                        Due ({clientStats.dueCount})
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.clientFilterChip, clientKhataFilter === 'ADVANCE' && styles.clientFilterChipActiveAdv]}
                                    onPress={() => setClientKhataFilter('ADVANCE')}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.clientFilterChipText, clientKhataFilter === 'ADVANCE' && styles.clientFilterChipTextActiveAdv]}>
                                        Advance ({clientStats.advanceCount})
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.clientFilterChip, clientKhataFilter === 'SETTLED' && styles.clientFilterChipActiveSettled]}
                                    onPress={() => setClientKhataFilter('SETTLED')}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.clientFilterChipText, clientKhataFilter === 'SETTLED' && styles.clientFilterChipTextActiveSettled]}>
                                        Settled ({clientStats.settledCount})
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Arrange / Reorder Bar */}
                        {filteredClients.length > 1 && (
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 }}>
                                <TouchableOpacity 
                                    style={[styles.reorderToggleBtn, isClientArrangeMode && styles.reorderToggleBtnActive]} 
                                    onPress={() => setIsClientArrangeMode(!isClientArrangeMode)}
                                    activeOpacity={0.8}
                                >
                                    <MaterialCommunityIcons name={isClientArrangeMode ? "check-circle" : "swap-vertical"} size={16} color={isClientArrangeMode ? "#FFFFFF" : "#2563EB"} />
                                    <Text style={[styles.reorderToggleBtnText, isClientArrangeMode && { color: "#FFFFFF" }]}>
                                        {isClientArrangeMode ? "Done Arranging" : "Arrange Order"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Client Cards List */}
                        {filteredClients.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <MaterialCommunityIcons name="account-group-outline" size={48} color="#94A3B8" />
                                <Text style={styles.emptyTitle}>No Clients Found</Text>
                                <Text style={styles.emptySub}>Add a new client to start tracking their Khatabook ledger.</Text>
                            </View>
                        ) : isClientArrangeMode ? (
                            <DraggableCardList
                                items={filteredClients}
                                itemHeight={64}
                                gap={8}
                                paddingHorizontal={0}
                                storageKey="@fleet_client_khata_clients_order_v2"
                                scrollViewRef={clientScrollViewRef}
                                scrollYRef={clientScrollYRef}
                                dragHint="Hold & drag row to arrange order"
                                onOrderChange={(reordered) => handleReorderClients(reordered)}
                                renderItem={(c) => (
                                    <View style={styles.reorderCompactCard}>
                                        <MaterialCommunityIcons name="drag-horizontal-variant" size={22} color="#64748B" style={{ marginRight: 10 }} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }} numberOfLines={1}>
                                                {c.name}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: '#64748B' }} numberOfLines={1}>
                                                {c.phone ? `📞 ${c.phone}` : 'No Phone'} {c.address ? `• 📍 ${c.address}` : ''}
                                            </Text>
                                        </View>
                                        <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" />
                                    </View>
                                )}
                            />
                        ) : (
                            filteredClients.map((c) => {
                                const metrics = getClientMetrics(c.id, c.opening_balance);
                                const isDue = metrics.pending > 0;
                                const isAdv = metrics.pending < 0;
                                return (
                                    <View key={c.id} style={styles.clientCardFluid}>
                                        {/* Top Row: Full Client Name with Action Icons */}
                                        <View style={styles.clientCardHeader}>
                                            <View style={{ flex: 1, marginRight: 8 }}>
                                                <Text style={styles.clientCardName}>{c.name}</Text>
                                            </View>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <TouchableOpacity 
                                                    style={styles.clientIconBtn}
                                                    onPress={() => openEditClientModal(c)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                                >
                                                    <MaterialCommunityIcons name="pencil-outline" size={16} color="#475569" />
                                                </TouchableOpacity>

                                                <TouchableOpacity 
                                                    style={[styles.clientIconBtn, { backgroundColor: '#FEE2E2' }]}
                                                    onPress={() => handleDeleteClient(c)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                                >
                                                    <MaterialCommunityIcons name="trash-can-outline" size={16} color="#DC2626" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* Sub Row: Phone Dialer Chip, Address & Net Balance Badge */}
                                        <View style={styles.clientSubRow}>
                                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginRight: 8 }}>
                                                {c.phone ? (
                                                    <TouchableOpacity 
                                                        style={styles.phoneChip}
                                                        onPress={() => handleCall(c.phone)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <MaterialCommunityIcons name="phone" size={12} color="#2563EB" />
                                                        <Text style={styles.phoneChipText}>{c.phone}</Text>
                                                    </TouchableOpacity>
                                                ) : (
                                                    <Text style={styles.clientCardSub}>No Phone</Text>
                                                )}
                                                {c.address ? (
                                                    <View style={styles.addressChip}>
                                                        <MaterialCommunityIcons name="map-marker-outline" size={12} color="#64748B" />
                                                        <Text style={styles.addressChipText} numberOfLines={1}>{c.address}</Text>
                                                    </View>
                                                ) : null}
                                            </View>

                                            <View style={[styles.clientBalanceBadge, isDue ? styles.clientBalanceDue : isAdv ? styles.clientBalanceAdv : styles.clientBalanceZero]}>
                                                <Text style={styles.clientBalanceLabel}>NET BALANCE</Text>
                                                <Text style={[styles.clientBalanceVal, isDue ? { color: '#DC2626' } : isAdv ? { color: '#16A34A' } : { color: '#475569' }]} numberOfLines={1}>
                                                    {isDue ? '₹' + metrics.pending.toLocaleString() + ' Due' : isAdv ? '₹' + Math.abs(metrics.pending).toLocaleString() + ' Adv' : '₹0 Settled'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Stats Row */}
                                        <View style={styles.clientStatsRow}>
                                            <View style={styles.clientStatCol}>
                                                <Text style={styles.clientStatLabel}>Total Billed</Text>
                                                <Text style={styles.clientStatVal} numberOfLines={1}>₹{metrics.billed.toLocaleString()}</Text>
                                            </View>
                                            <View style={styles.clientStatDivider} />
                                            <View style={styles.clientStatCol}>
                                                <Text style={styles.clientStatLabel}>Received</Text>
                                                <Text style={[styles.clientStatVal, { color: '#059669' }]} numberOfLines={1}>₹{metrics.received.toLocaleString()}</Text>
                                            </View>
                                            <View style={styles.clientStatDivider} />
                                            <View style={styles.clientStatCol}>
                                                <Text style={styles.clientStatLabel}>Entries</Text>
                                                <Text style={styles.clientStatVal}>{metrics.txnsCount}</Text>
                                            </View>
                                        </View>

                                        {/* Action Buttons Row */}
                                        <View style={styles.clientActionRow}>
                                            <TouchableOpacity 
                                                style={styles.clientPassbookBtn}
                                                onPress={() => {
                                                    setSelectedClientForStatement(c);
                                                    setIsClientStatementModalVisible(true);
                                                }}
                                                activeOpacity={0.8}
                                            >
                                                <MaterialCommunityIcons name="book-open-outline" size={14} color="#2563EB" />
                                                <Text style={styles.clientPassbookBtnText}>Passbook</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity 
                                                style={styles.clientEntryBtn}
                                                onPress={() => {
                                                    setSelectedClientForTxn(c);
                                                    setEditingClientTxn(null);
                                                    setClientTxnAmount('');
                                                    setClientTxnNotes('');
                                                    setIsClientTxnModalVisible(true);
                                                }}
                                                activeOpacity={0.8}
                                            >
                                                <MaterialCommunityIcons name="plus-circle" size={14} color="#FFFFFF" />
                                                <Text style={styles.clientEntryBtnText}>+ Entry</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity 
                                                style={styles.clientPdfBtn}
                                                onPress={() => exportClientPdf(c)}
                                                activeOpacity={0.8}
                                            >
                                                <MaterialCommunityIcons name="file-pdf-box" size={16} color="#DC2626" />
                                                <Text style={styles.clientPdfBtnText}>PDF</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </ScrollView>
                </View>
            ) : activeView === 'REPORTS' ? (
                <View style={styles.khatabahiContainer}>
                    {/* Khatabahi Blue Header matching khatabahi.jpeg */}
                    <View style={styles.khatabahiHeader}>
                        <View style={styles.khatabahiHeaderTitleRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <MaterialCommunityIcons name="notebook-outline" size={22} color="#FFFFFF" />
                                <Text style={styles.khatabahiHeaderTitle}>My Business</Text>
                                <MaterialCommunityIcons name="pencil" size={16} color="rgba(255,255,255,0.7)" />
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                                <TouchableOpacity onPress={() => Alert.alert('Khatabahi Guide', 'Aggregates all daily Inflow (Payments received/advance) vs Outflow (Billed freight/materials). Tap Download Report to export as PDF, print in A4, or send via WhatsApp.')}>
                                    <MaterialCommunityIcons name="help-circle-outline" size={22} color="#FFFFFF" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setIsReportFilterModalVisible(true)}>
                                    <MaterialCommunityIcons name="tune-vertical" size={22} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* CASHBOOK | REPORTS subtabs */}
                        <View style={styles.khatabahiTabsRow}>
                            <TouchableOpacity 
                                style={styles.khatabahiTab} 
                                onPress={() => setActiveView('CLIENTS')}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.khatabahiTabText}>CASHBOOK</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.khatabahiTab, styles.khatabahiTabActive]} 
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.khatabahiTabText, styles.khatabahiTabTextActive]}>REPORTS</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Date Selector & Filters Bar (exact match to khatabahi.jpeg) */}
                    <View style={styles.khatabahiDateBar}>
                        <TouchableOpacity 
                            style={styles.khatabahiDateSelectorBtn}
                            onPress={() => setShowReportStartDatePicker(true)}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="calendar-month-outline" size={20} color="#1D4ED8" />
                            <Text style={styles.khatabahiDateSelectorText}>
                                {formatKhatabahiRange(reportStartDate)} | {formatKhatabahiRange(reportEndDate)}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.khatabahiFiltersBtn}
                            onPress={() => setIsReportFilterModalVisible(true)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.khatabahiFiltersBadge}>
                                <Text style={styles.khatabahiFiltersBadgeText}>New</Text>
                            </View>
                            <MaterialCommunityIcons name="tune-vertical" size={18} color="#1D4ED8" />
                            <Text style={styles.khatabahiFiltersText}>Filters</Text>
                        </TouchableOpacity>
                    </View>

                    {showReportStartDatePicker && (
                        <DateTimePicker
                            value={reportStartDate}
                            mode="date"
                            display="default"
                            onChange={(event, selectedDate) => {
                                setShowReportStartDatePicker(false);
                                if (selectedDate) {
                                    setReportStartDate(selectedDate);
                                    setShowReportEndDatePicker(true);
                                }
                            }}
                        />
                    )}

                    {showReportEndDatePicker && (
                        <DateTimePicker
                            value={reportEndDate}
                            mode="date"
                            display="default"
                            onChange={(event, selectedDate) => {
                                setShowReportEndDatePicker(false);
                                if (selectedDate) {
                                    if (selectedDate < reportStartDate) {
                                        Alert.alert('Invalid Range', 'End date cannot be earlier than start date.');
                                        return;
                                    }
                                    setReportEndDate(selectedDate);
                                }
                            }}
                        />
                    )}

                    {/* Active Party Filter Chip if not ALL */}
                    {reportPartyFilter !== 'ALL' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EFF6FF', paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#DBEAFE' }}>
                            <Text style={{ fontSize: 12, color: '#1E40AF', fontWeight: '700' }}>
                                Party: {clients.find(c => String(c.id) === String(reportPartyFilter))?.name || 'Selected'}
                            </Text>
                            <TouchableOpacity onPress={() => setReportPartyFilter('ALL')}>
                                <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '800' }}>Clear Filter ✕</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {(() => {
                        const reportData = getReportData();
                        return (
                            <View style={{ flex: 1 }}>
                                {/* Equation Summary Card (exact match to khatabahi.jpeg) */}
                                <View style={styles.khatabahiEquationCard}>
                                    <View style={styles.khatabahiEquationCol}>
                                        <Text style={styles.khatabahiEquationLabel}>Total In</Text>
                                        <Text style={[styles.khatabahiEquationVal, { color: '#16A34A' }]}>
                                            ₹ {reportData.totalIn.toLocaleString('en-IN')}
                                        </Text>
                                    </View>

                                    <Text style={styles.khatabahiEquationOp}>—</Text>

                                    <View style={styles.khatabahiEquationCol}>
                                        <Text style={styles.khatabahiEquationLabel}>Total Out</Text>
                                        <Text style={[styles.khatabahiEquationVal, { color: '#DC2626' }]}>
                                            ₹ {reportData.totalOut.toLocaleString('en-IN')}
                                        </Text>
                                    </View>

                                    <Text style={styles.khatabahiEquationOp}>=</Text>

                                    <View style={styles.khatabahiEquationCol}>
                                        <Text style={styles.khatabahiEquationLabel}>Net Balance</Text>
                                        <Text style={[styles.khatabahiEquationVal, { color: reportData.netBalance >= 0 ? '#1D4ED8' : '#DC2626' }]}>
                                            ₹ {reportData.netBalance.toLocaleString('en-IN')}
                                        </Text>
                                    </View>

                                    <TouchableOpacity 
                                        style={styles.khatabahiExpandCircle}
                                        onPress={() => Alert.alert('Net Balance Info', `Inflow (Received): ₹${reportData.totalIn.toLocaleString()}\nOutflow (Billed): ₹${reportData.totalOut.toLocaleString()}\nNet Balance: ₹${reportData.netBalance.toLocaleString()}`)}
                                    >
                                        <MaterialCommunityIcons name="chevron-down" size={18} color="#1D4ED8" />
                                    </TouchableOpacity>
                                </View>

                                {/* Table Column Headers */}
                                <View style={styles.khatabahiTableHead}>
                                    <Text style={[styles.khatabahiTableHeadCol, { width: 85 }]}>Date</Text>
                                    <Text style={[styles.khatabahiTableHeadCol, { flex: 1, textAlign: 'center' }]}>Total In</Text>
                                    <Text style={[styles.khatabahiTableHeadCol, { flex: 1, textAlign: 'center' }]}>Total Out</Text>
                                    <Text style={[styles.khatabahiTableHeadCol, { flex: 1, textAlign: 'right' }]}>Balance</Text>
                                    <View style={{ width: 24 }} />
                                </View>

                                {/* Table Rows List */}
                                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                                    {reportData.days.length === 0 ? (
                                        <View style={{ alignItems: 'center', paddingVertical: 50 }}>
                                            <MaterialCommunityIcons name="calendar-blank-outline" size={48} color="#CBD5E1" />
                                            <Text style={{ fontSize: 15, fontWeight: '700', color: '#64748B', marginTop: 12 }}>No Transactions in Period</Text>
                                            <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Pick another date range or record client transactions.</Text>
                                        </View>
                                    ) : (
                                        reportData.days.map((dayItem) => {
                                            const isExpanded = reportExpandedDate === dayItem.date;
                                            return (
                                                <View key={dayItem.date} style={styles.khatabahiTableRow}>
                                                    <TouchableOpacity 
                                                        style={styles.khatabahiTableRowMain}
                                                        onPress={() => setReportExpandedDate(isExpanded ? null : dayItem.date)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={[styles.khatabahiRowDate, { width: 85 }]}>{formatRowDate(dayItem.date)}</Text>
                                                        <Text style={[styles.khatabahiRowIn, { flex: 1 }]}>₹ {dayItem.totalIn.toLocaleString('en-IN')}</Text>
                                                        <Text style={[styles.khatabahiRowOut, { flex: 1 }]}>₹ {dayItem.totalOut.toLocaleString('en-IN')}</Text>
                                                        <Text style={[styles.khatabahiRowBal, { flex: 1, color: dayItem.balance >= 0 ? '#1D4ED8' : '#DC2626' }]}>
                                                            ₹ {dayItem.balance.toLocaleString('en-IN')}
                                                        </Text>
                                                        <MaterialCommunityIcons 
                                                            name={isExpanded ? "chevron-down" : "chevron-right"} 
                                                            size={20} 
                                                            color="#1D4ED8" 
                                                        />
                                                    </TouchableOpacity>

                                                    {/* Expandable Entries Details */}
                                                    {isExpanded && (
                                                        <View style={styles.khatabahiRowDetailsBox}>
                                                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>
                                                                Entries on {formatRowDate(dayItem.date)} ({dayItem.transactions.length})
                                                            </Text>
                                                            {dayItem.transactions.map((tx, idx) => {
                                                                const c = clients.find(cl => String(cl.id) === String(tx.client_id));
                                                                const txType = tx.type || tx.txn_type || 'BILLED';
                                                                const isDebit = txType === 'BILLED';
                                                                return (
                                                                    <View key={tx.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: idx < dayItem.transactions.length - 1 ? 1 : 0, borderBottomColor: '#E2E8F0' }}>
                                                                        <View style={{ flex: 1, marginRight: 8 }}>
                                                                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>{c ? c.name : 'Party #' + tx.client_id}</Text>
                                                                            <Text style={{ fontSize: 11, color: '#64748B' }}>{tx.notes || tx.payment_mode || 'Cash'}</Text>
                                                                        </View>
                                                                        <View style={{ alignItems: 'flex-end' }}>
                                                                            <Text style={{ fontSize: 13, fontWeight: '800', color: isDebit ? '#DC2626' : '#16A34A' }}>
                                                                                {isDebit ? '- ₹' : '+ ₹'}{parseFloat(tx.amount || 0).toLocaleString()}
                                                                            </Text>
                                                                            <Text style={{ fontSize: 10, color: '#94A3B8' }}>{txType}</Text>
                                                                        </View>
                                                                    </View>
                                                                );
                                                            })}
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        })
                                    )}
                                </ScrollView>

                                {/* Sticky Bottom DOWNLOAD REPORT Button (exact match to khatabahi.jpeg) */}
                                <View style={styles.khatabahiBottomSticky}>
                                    <TouchableOpacity 
                                        style={styles.khatabahiDownloadBtn}
                                        onPress={() => {
                                            openExportModal({
                                                type: 'DATE_REPORT',
                                                startDate: reportStartDate,
                                                endDate: reportEndDate,
                                                partyId: reportPartyFilter,
                                                partyName: reportPartyFilter === 'ALL' ? 'All Clients' : clients.find(c => String(c.id) === String(reportPartyFilter))?.name || 'Selected Client'
                                            });
                                        }}
                                        activeOpacity={0.85}
                                    >
                                        <MaterialCommunityIcons name="tray-arrow-down" size={20} color="#1D4ED8" />
                                        <Text style={styles.khatabahiDownloadText}>DOWNLOAD REPORT</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })()}
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    {/* Freight Status Filter Bar */}
                    <View style={styles.freightFilterBar}>
                        {['ALL', 'PENDING', 'PARTIAL', 'PAID'].map(filter => (
                            <TouchableOpacity
                                key={filter}
                                style={[styles.freightFilterChip, freightStatusFilter === filter && styles.freightFilterChipActive]}
                                onPress={() => setFreightStatusFilter(filter)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.freightFilterText, freightStatusFilter === filter && styles.freightFilterTextActive]}>
                                    {filter}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <ScrollView
                        style={styles.content}
                        contentContainerStyle={styles.scrollContent}
                        refreshControl={<RefreshControl refreshing={freightLoading} onRefresh={fetchFreightLedger} />}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* 3 Metric Cards: Total Billed, Collected, Pending */}
                        <View style={styles.freightMetricsRow}>
                            <View style={[styles.freightMetricCard, { borderLeftColor: '#3B82F6' }]}>
                                <Text style={styles.freightMetricLabel}>TOTAL BILTI</Text>
                                <Text style={styles.freightMetricVal}>₹{freightData.summary.total_freight_billed?.toLocaleString()}</Text>
                                <Text style={styles.freightMetricSub}>{freightData.summary.total_trips} trips</Text>
                            </View>

                            <View style={[styles.freightMetricCard, { borderLeftColor: '#10B981' }]}>
                                <Text style={styles.freightMetricLabel}>COLLECTED</Text>
                                <Text style={[styles.freightMetricVal, { color: '#059669' }]}>
                                    ₹{freightData.summary.total_freight_received?.toLocaleString()}
                                </Text>
                                <Text style={styles.freightMetricSub}>{freightData.summary.collection_percentage}%</Text>
                            </View>

                            <View style={[styles.freightMetricCard, { borderLeftColor: '#EF4444' }]}>
                                <Text style={styles.freightMetricLabel}>PENDING</Text>
                                <Text style={[styles.freightMetricVal, { color: '#DC2626' }]}>
                                    ₹{freightData.summary.total_freight_pending?.toLocaleString()}
                                </Text>
                                <Text style={[styles.freightMetricSub, { color: '#DC2626', fontWeight: '700' }]}>Outstanding</Text>
                            </View>
                        </View>

                        {/* Progress Bar */}
                        <View style={styles.progressContainer}>
                            <View style={styles.progressHeader}>
                                <Text style={styles.progressLabel}>Collection Recovery Index</Text>
                                <Text style={styles.progressPercent}>{freightData.summary.collection_percentage}%</Text>
                            </View>
                            <View style={styles.progressBarTrack}>
                                <View style={[styles.progressBarFill, { width: `${Math.min(100, freightData.summary.collection_percentage)}%` }]} />
                            </View>
                        </View>

                        {/* List of Trip Freight Items */}
                        {freightLoading ? (
                            <View style={{ alignItems: 'center', marginTop: 40 }}>
                                <ActivityIndicator size="large" color="#0F172A" />
                                <Text style={{ marginTop: 10, color: '#64748B' }}>Calculating freight ledger...</Text>
                            </View>
                        ) : freightData.trips.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <MaterialCommunityIcons name="truck-outline" size={48} color="#94A3B8" />
                                <Text style={styles.emptyTitle}>No Freight Records Found</Text>
                                <Text style={styles.emptySub}>Trips with bhada will automatically populate here.</Text>
                            </View>
                        ) : (
                            freightData.trips.map(trip => {
                                const isPaid = trip.freight_status === 'PAID';
                                const isPartial = trip.freight_status === 'PARTIAL';
                                const statusColor = isPaid ? '#10B981' : isPartial ? '#F59E0B' : '#EF4444';
                                const statusBg = isPaid ? '#DCFCE7' : isPartial ? '#FEF3C7' : '#FEE2E2';

                                return (
                                    <View key={trip.id} style={styles.freightCard}>
                                        <View style={styles.freightCardHeader}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <View style={styles.freightTruckIcon}>
                                                    <MaterialCommunityIcons name="truck" size={18} color="#0F172A" />
                                                </View>
                                                <View>
                                                    <Text style={styles.freightVehicle}>{trip.vehicle_number}</Text>
                                                    <Text style={styles.freightTripId}>
                                                        Trip #{trip.id} • {trip.created_at ? new Date(trip.created_at).toLocaleDateString() : ''}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={[styles.freightStatusBadge, { backgroundColor: statusBg }]}>
                                                <Text style={[styles.freightStatusBadgeText, { color: statusColor }]}>
                                                    {trip.freight_status}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.freightRouteRow}>
                                            <Text style={styles.freightRouteText}>
                                                {trip.origin || 'Origin'} ➔ {trip.destination || 'Destination'}
                                            </Text>
                                            <Text style={styles.freightMaterialText}>
                                                {trip.material_type} ({trip.weight_tons} T)
                                            </Text>
                                        </View>

                                        <View style={styles.freightAmountsGrid}>
                                            <View style={styles.amountCol}>
                                                <Text style={styles.colLabel}>Total Bhada</Text>
                                                <Text style={styles.colVal}>₹{trip.bhada?.toLocaleString()}</Text>
                                            </View>
                                            <View style={styles.amountCol}>
                                                <Text style={styles.colLabel}>Advance Paid</Text>
                                                <Text style={[styles.colVal, { color: '#059669' }]}>
                                                    ₹{trip.advance_freight_received?.toLocaleString()}
                                                </Text>
                                            </View>
                                            <View style={styles.amountCol}>
                                                <Text style={styles.colLabel}>Pending Balance</Text>
                                                <Text style={[styles.colVal, { color: trip.pending_freight > 0 ? '#DC2626' : '#059669' }]}>
                                                    ₹{trip.pending_freight?.toLocaleString()}
                                                </Text>
                                            </View>
                                        </View>

                                        {trip.pending_freight > 0 && (
                                            <TouchableOpacity
                                                style={styles.collectPaymentBtn}
                                                onPress={() => {
                                                    setSelectedTripForPayment(trip);
                                                    setFreightPaymentAmount(String(trip.pending_freight));
                                                }}
                                                activeOpacity={0.8}
                                            >
                                                <MaterialCommunityIcons name="cash-plus" size={16} color="#FFFFFF" />
                                                <Text style={styles.collectPaymentBtnText}>Record Payment Received</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })
                        )}
                    </ScrollView>
                </View>
            )}

            {/* Add Client Modal */}
            <Modal visible={isAddClientModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Add New Client</Text>
                                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Create a customer or vendor khata account</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsAddClientModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.formGroup}>
                                <Text style={styles.modalLabel}>Client / Business Name *</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. UltraTech Cement, Sharma Builders"
                                    placeholderTextColor="#94A3B8"
                                    value={newClientName}
                                    onChangeText={setNewClientName}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.modalLabel}>Phone Number (Optional)</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. 9876543210"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="phone-pad"
                                    value={newClientPhone}
                                    onChangeText={setNewClientPhone}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.modalLabel}>Location / Site Address (Optional)</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. Raipur Plant, NH-6 Bypass"
                                    placeholderTextColor="#94A3B8"
                                    value={newClientAddress}
                                    onChangeText={setNewClientAddress}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.modalLabel}>Previous Pending Balance (₹) (Optional)</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="0.0"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="numeric"
                                    value={newClientOpeningBalance}
                                    onChangeText={setNewClientOpeningBalance}
                                />
                            </View>

                            <TouchableOpacity 
                                style={[styles.submitBtn, { backgroundColor: '#2563EB', marginTop: 18 }]} 
                                onPress={handleAddClient} 
                                activeOpacity={0.85}
                            >
                                <MaterialCommunityIcons name="account-plus" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                                <Text style={[styles.submitBtnText, { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }]}>Save Client</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Record Client Transaction Modal */}
            <Modal visible={isClientTxnModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>
                                    {editingClientTxn ? 'Edit Transaction' : 'Record Client Transaction'}
                                </Text>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#2563EB', marginTop: 2 }}>
                                    {selectedClientForTxn ? selectedClientForTxn.name : 'Select Client'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => { setIsClientTxnModalVisible(false); setEditingClientTxn(null); }}>
                                <MaterialCommunityIcons name="close" size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Client Dropdown Selector (if not editing) */}
                            {!editingClientTxn && (
                                <View style={styles.formGroup}>
                                    <Text style={styles.modalLabel}>Select Client *</Text>
                                    <TouchableOpacity 
                                        style={styles.staffSelectBtn}
                                        onPress={() => setIsClientPickerVisible(true)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                            <MaterialCommunityIcons name="account-tie" size={20} color="#64748B" />
                                            <Text style={selectedClientForTxn ? styles.staffSelectVal : styles.staffSelectPlaceholder}>
                                                {selectedClientForTxn ? selectedClientForTxn.name : "Select Client from saved list"}
                                            </Text>
                                        </View>
                                        <MaterialCommunityIcons name="chevron-down" size={18} color="#64748B" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Type Selector: Billed vs Received vs Advance */}
                            <View style={styles.clientTypeSwitcher}>
                                <TouchableOpacity
                                    style={[
                                        styles.clientTypeBtn,
                                        clientTxnType === 'BILLED' && styles.clientTypeBtnBilledActive
                                    ]}
                                    onPress={() => setClientTxnType('BILLED')}
                                    activeOpacity={0.8}
                                >
                                    <MaterialCommunityIcons 
                                        name="arrow-top-right" 
                                        size={18} 
                                        color={clientTxnType === 'BILLED' ? '#FFFFFF' : '#DC2626'} 
                                    />
                                    <Text style={[styles.clientTypeBtnText, clientTxnType === 'BILLED' && styles.clientTypeBtnTextActive]}>
                                        Gave / Billed
                                    </Text>
                                    <Text style={[styles.clientTypeBtnSub, clientTxnType === 'BILLED' && styles.clientTypeBtnSubActive]}>
                                        माल दिया / बिल
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.clientTypeBtn,
                                        clientTxnType === 'RECEIVED' && styles.clientTypeBtnReceivedActive
                                    ]}
                                    onPress={() => setClientTxnType('RECEIVED')}
                                    activeOpacity={0.8}
                                >
                                    <MaterialCommunityIcons 
                                        name="arrow-bottom-left" 
                                        size={18} 
                                        color={clientTxnType === 'RECEIVED' ? '#FFFFFF' : '#16A34A'} 
                                    />
                                    <Text style={[styles.clientTypeBtnText, clientTxnType === 'RECEIVED' && styles.clientTypeBtnTextActive]}>
                                        Got / Payment
                                    </Text>
                                    <Text style={[styles.clientTypeBtnSub, clientTxnType === 'RECEIVED' && styles.clientTypeBtnSubActive]}>
                                        रुपया मिला
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.clientTypeBtn,
                                        clientTxnType === 'ADVANCE' && styles.clientTypeBtnAdvanceActive
                                    ]}
                                    onPress={() => setClientTxnType('ADVANCE')}
                                    activeOpacity={0.8}
                                >
                                    <MaterialCommunityIcons 
                                        name="hand-coin" 
                                        size={18} 
                                        color={clientTxnType === 'ADVANCE' ? '#FFFFFF' : '#0284C7'} 
                                    />
                                    <Text style={[styles.clientTypeBtnText, clientTxnType === 'ADVANCE' && styles.clientTypeBtnTextActive]}>
                                        Advance
                                    </Text>
                                    <Text style={[styles.clientTypeBtnSub, clientTxnType === 'ADVANCE' && styles.clientTypeBtnSubActive]}>
                                        अग्रिम जमा
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.modalLabel}>Amount (₹) *</Text>
                                <TextInput
                                    style={[styles.modalInput, { fontSize: 20, fontWeight: '800' }]}
                                    placeholder="₹ 0.00"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="numeric"
                                    value={clientTxnAmount}
                                    onChangeText={setClientTxnAmount}
                                    autoFocus
                                />
                            </View>

                            {/* Payment Mode */}
                            <View style={styles.formGroup}>
                                <Text style={styles.modalLabel}>Payment Mode</Text>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    {['CASH', 'ONLINE', 'CHEQUE'].map(m => (
                                        <TouchableOpacity
                                            key={m}
                                            style={[styles.freightModeChip, clientTxnMode === m && styles.freightModeChipActive]}
                                            onPress={() => setClientTxnMode(m)}
                                        >
                                            <Text style={[styles.freightModeText, clientTxnMode === m && styles.freightModeTextActive]}>{m}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.modalLabel}>Challan / Bill / Notes (Optional)</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. Challan #4092, Truck CG04MC1234, 30 Tons"
                                    placeholderTextColor="#94A3B8"
                                    value={clientTxnNotes}
                                    onChangeText={setClientTxnNotes}
                                />
                            </View>

                            {/* Sync to Daily Ledger Checkbox (only if adding, not editing) */}
                            {!editingClientTxn && (clientTxnType === 'RECEIVED' || clientTxnType === 'ADVANCE') && (
                                <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}
                                    onPress={() => setSyncClientTxnToDaily(!syncClientTxnToDaily)}
                                >
                                    <MaterialCommunityIcons
                                        name={syncClientTxnToDaily ? "checkbox-marked" : "checkbox-blank-outline"}
                                        size={22}
                                        color="#2563EB"
                                    />
                                    <Text style={{ fontSize: 13, color: '#334155', fontWeight: '600' }}>
                                        Also record in Daily Cashflow as Income
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {/* Solid Color Form Confirm Button */}
                            <TouchableOpacity 
                                style={[
                                    styles.submitBtn, 
                                    { 
                                        backgroundColor: clientTxnType === 'BILLED' 
                                            ? '#DC2626' 
                                            : clientTxnType === 'RECEIVED' 
                                            ? '#16A34A' 
                                            : '#0284C7' 
                                    }
                                ]} 
                                onPress={handleRecordClientTxn} 
                                activeOpacity={0.85}
                            >
                                <MaterialCommunityIcons 
                                    name={editingClientTxn ? "check-circle" : "check-bold"} 
                                    size={18} 
                                    color="#FFFFFF" 
                                />
                                <Text style={styles.submitBtnText}>
                                    {editingClientTxn 
                                        ? 'Update Entry' 
                                        : clientTxnType === 'BILLED' 
                                        ? 'Confirm Billed / Gave (₹)' 
                                        : clientTxnType === 'RECEIVED' 
                                        ? 'Confirm Payment Received (₹)' 
                                        : 'Confirm Advance (₹)'
                                    }
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Client Statement / Passbook Modal */}
            <Modal visible={isClientStatementModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: '88%' }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={styles.modalTitle}>Khata Passbook</Text>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 2 }}>
                                    {selectedClientForStatement ? selectedClientForStatement.name : ''}
                                </Text>
                                {selectedClientForStatement?.phone && (
                                    <Text style={{ fontSize: 11, color: '#64748B' }}>
                                        📞 {selectedClientForStatement.phone} {selectedClientForStatement.address ? `• ${selectedClientForStatement.address}` : ''}
                                    </Text>
                                )}
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                {selectedClientForStatement && (
                                    <TouchableOpacity 
                                        style={styles.passbookPdfBtn}
                                        onPress={() => {
                                            openExportModal({
                                                type: 'CLIENT_STATEMENT',
                                                client: selectedClientForStatement
                                            });
                                        }}
                                        activeOpacity={0.8}
                                    >
                                        <MaterialCommunityIcons name="export-variant" size={16} color="#2563EB" />
                                        <Text style={[styles.passbookPdfBtnText, { color: '#2563EB' }]}>Export</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={() => setIsClientStatementModalVisible(false)}>
                                    <MaterialCommunityIcons name="close" size={24} color="#0F172A" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {selectedClientForStatement ? (() => {
                            const m = getClientMetrics(selectedClientForStatement.id, selectedClientForStatement.opening_balance);
                            const rawTxns = clientTransactions
                                .filter(t => String(t.client_id) === String(selectedClientForStatement.id))
                                .sort((a, b) => new Date(a.date) - new Date(b.date));

                            let runningBal = parseFloat(selectedClientForStatement.opening_balance) || 0;
                            const enrichedTxns = rawTxns.map(t => {
                                const type = t.type || t.txn_type || 'BILLED';
                                const isDebit = type === 'BILLED';
                                const amt = parseFloat(t.amount) || 0;
                                if (isDebit) {
                                    runningBal += amt;
                                } else {
                                    runningBal -= amt;
                                }
                                return {
                                    ...t,
                                    type,
                                    txn_type: type,
                                    amount: amt,
                                    isDebit,
                                    runningBalance: runningBal
                                };
                            });

                            const displayTxns = [...enrichedTxns].reverse();

                            return (
                                <View style={{ flex: 1 }}>
                                    {/* Mini Summary Banner */}
                                    <View style={styles.passbookSummary}>
                                        <View>
                                            <Text style={styles.passbookLabel}>NET BALANCE (LE NA HAI)</Text>
                                            <Text style={[styles.passbookDue, { color: m.pending > 0 ? '#DC2626' : m.pending < 0 ? '#16A34A' : '#475569' }]}>
                                                {m.pending > 0 ? `₹${m.pending.toLocaleString()} Due` : m.pending < 0 ? `₹${Math.abs(m.pending).toLocaleString()} Adv` : '₹0 Settled'}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '700' }}>Billed: ₹{m.billed.toLocaleString()}</Text>
                                            <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '700' }}>Received: ₹{m.received.toLocaleString()}</Text>
                                            <Text style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{enrichedTxns.length} entries</Text>
                                        </View>
                                    </View>

                                    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                                        {displayTxns.length === 0 && (!selectedClientForStatement.opening_balance || parseFloat(selectedClientForStatement.opening_balance) === 0) ? (
                                            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                                <MaterialCommunityIcons name="book-open-page-variant-outline" size={40} color="#CBD5E1" />
                                                <Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 10, fontSize: 13 }}>
                                                    No transactions recorded yet for this client.
                                                </Text>
                                            </View>
                                        ) : (
                                            <>
                                                {displayTxns.map(t => {
                                                    const isDebit = t.isDebit;
                                                    const bal = t.runningBalance;
                                                    return (
                                                        <View key={t.id} style={styles.passbookRow}>
                                                            <View style={{ flex: 1, marginRight: 10 }}>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                                    <Text style={styles.passbookDate}>{t.date}</Text>
                                                                    <View style={[styles.passbookTypePill, { backgroundColor: isDebit ? '#FEF2F2' : '#F0FDF4' }]}>
                                                                        <Text style={[styles.passbookTypePillText, { color: isDebit ? '#DC2626' : '#16A34A' }]}>
                                                                            {t.type}
                                                                        </Text>
                                                                    </View>
                                                                    <View style={styles.passbookModePill}>
                                                                        <Text style={styles.passbookModeText}>{t.payment_mode || 'CASH'}</Text>
                                                                    </View>
                                                                </View>
                                                                {t.notes ? <Text style={styles.passbookNote}>{t.notes}</Text> : null}
                                                                <Text style={{ fontSize: 11, fontWeight: '700', color: bal > 0 ? '#DC2626' : bal < 0 ? '#16A34A' : '#64748B', marginTop: 3 }}>
                                                                    Running Bal: ₹{Math.abs(bal).toLocaleString()} {bal > 0 ? 'Dr (Due)' : bal < 0 ? 'Cr (Adv)' : 'Settled'}
                                                                </Text>
                                                            </View>

                                                            <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                                                                <Text style={[styles.passbookAmt, { color: isDebit ? '#DC2626' : '#16A34A' }]}>
                                                                    {isDebit ? '+ ' : '- '}₹{t.amount.toLocaleString()}
                                                                </Text>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
                                                                    <TouchableOpacity 
                                                                        onPress={() => openEditTxnModal(t, selectedClientForStatement)} 
                                                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                                    >
                                                                        <MaterialCommunityIcons name="pencil-outline" size={16} color="#2563EB" />
                                                                    </TouchableOpacity>
                                                                    <TouchableOpacity 
                                                                        onPress={() => handleDeleteClientTxn(t.id)} 
                                                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                                    >
                                                                        <MaterialCommunityIcons name="trash-can-outline" size={16} color="#DC2626" />
                                                                    </TouchableOpacity>
                                                                </View>
                                                            </View>
                                                        </View>
                                                    );
                                                })}

                                                {selectedClientForStatement.opening_balance > 0 && (
                                                    <View style={[styles.passbookRow, { backgroundColor: '#F8FAFC', borderLeftWidth: 3, borderLeftColor: '#DC2626' }]}>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.passbookDate}>Opening Balance</Text>
                                                            <Text style={styles.passbookNote}>Initial Balance Brought Forward</Text>
                                                        </View>
                                                        <Text style={[styles.passbookAmt, { color: '#DC2626' }]}>+ ₹{parseFloat(selectedClientForStatement.opening_balance).toLocaleString()}</Text>
                                                    </View>
                                                )}
                                            </>
                                        )}
                                    </ScrollView>

                                    <TouchableOpacity
                                        style={{ backgroundColor: '#0F172A', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10, flexDirection: 'row', gap: 8 }}
                                        onPress={() => {
                                            setSelectedClientForTxn(selectedClientForStatement);
                                            setEditingClientTxn(null);
                                            setClientTxnAmount('');
                                            setClientTxnNotes('');
                                            setIsClientTxnModalVisible(true);
                                        }}
                                    >
                                        <MaterialCommunityIcons name="plus-circle" size={16} color="#FFFFFF" />
                                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Record New Transaction</Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })() : null}
                    </View>
                </View>
            </Modal>

            {/* PDF Viewer / Export Options Modal with 4 Specific Actions */}
            <Modal visible={isExportModalVisible} animationType="fade" transparent={true}>
                <View style={styles.exportModalOverlay}>
                    <View style={styles.exportModalContent}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={{ fontSize: 17, fontWeight: '900', color: '#0F172A' }}>
                                    {exportTarget?.type === 'DATE_REPORT' ? 'Export Date-Wise Report' : 'Export Khata Statement'}
                                </Text>
                                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                                    {exportTarget?.type === 'DATE_REPORT' 
                                        ? `${formatKhatabahiRange(reportStartDate)} - ${formatKhatabahiRange(reportEndDate)}`
                                        : exportTarget?.client?.name || 'Party Statement'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsExportModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {isExporting ? (
                            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                                <ActivityIndicator size="large" color="#2563EB" />
                                <Text style={{ marginTop: 12, fontSize: 13, color: '#64748B', fontWeight: '600' }}>Preparing statement export...</Text>
                            </View>
                        ) : (
                            <View style={{ gap: 10 }}>
                                {/* Option 1: Save as PDF */}
                                <TouchableOpacity 
                                    style={styles.exportOptionCard} 
                                    onPress={() => handleExportAction('SAVE_PDF')}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.exportOptionIconBox, { backgroundColor: '#FEE2E2' }]}>
                                        <MaterialCommunityIcons name="file-pdf-box" size={24} color="#DC2626" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.exportOptionTitle}>Save as PDF</Text>
                                        <Text style={styles.exportOptionSub}>Save or download formatted PDF file to device</Text>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                                </TouchableOpacity>

                                {/* Option 2: Print in A4 */}
                                <TouchableOpacity 
                                    style={styles.exportOptionCard} 
                                    onPress={() => handleExportAction('PRINT_A4')}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.exportOptionIconBox, { backgroundColor: '#EFF6FF' }]}>
                                        <MaterialCommunityIcons name="printer" size={24} color="#2563EB" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.exportOptionTitle}>Print in A4</Text>
                                        <Text style={styles.exportOptionSub}>System print preview formatted for standard A4 paper</Text>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                                </TouchableOpacity>

                                {/* Option 3: Send via WhatsApp */}
                                <TouchableOpacity 
                                    style={styles.exportOptionCard} 
                                    onPress={() => handleExportAction('WHATSAPP')}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.exportOptionIconBox, { backgroundColor: '#DCFCE7' }]}>
                                        <MaterialCommunityIcons name="whatsapp" size={24} color="#16A34A" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.exportOptionTitle}>Send via WhatsApp</Text>
                                        <Text style={styles.exportOptionSub}>Share statement file (type or pick contact in WhatsApp)</Text>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                                </TouchableOpacity>

                                {/* Option 4: Save as Image */}
                                <TouchableOpacity 
                                    style={styles.exportOptionCard} 
                                    onPress={() => handleExportAction('SAVE_IMAGE')}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.exportOptionIconBox, { backgroundColor: '#F3E8FF' }]}>
                                        <MaterialCommunityIcons name="image-outline" size={24} color="#7C3AED" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.exportOptionTitle}>Save as Image</Text>
                                        <Text style={styles.exportOptionSub}>Save or share high-resolution statement graphic</Text>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Date-Wise Report Filters Modal */}
            <Modal visible={isReportFilterModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Report Filters</Text>
                                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Filter Date-Wise Report by client</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsReportFilterModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.inputLabel, { marginTop: 10 }]}>SELECT PARTY</Text>
                        <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                            <TouchableOpacity
                                style={[styles.exportOptionCard, { marginBottom: 6 }, reportPartyFilter === 'ALL' && { borderColor: '#1D4ED8', backgroundColor: '#EFF6FF' }]}
                                onPress={() => { setReportPartyFilter('ALL'); setIsReportFilterModalVisible(false); }}
                            >
                                <MaterialCommunityIcons name="account-group" size={20} color={reportPartyFilter === 'ALL' ? '#1D4ED8' : '#64748B'} style={{ marginRight: 10 }} />
                                <Text style={[{ fontSize: 14, fontWeight: '700', color: '#0F172A' }, reportPartyFilter === 'ALL' && { color: '#1D4ED8', fontWeight: '900' }]}>
                                    All Clients ({clients.length})
                                </Text>
                            </TouchableOpacity>

                            {clients.map(c => {
                                const isSel = String(reportPartyFilter) === String(c.id);
                                return (
                                    <TouchableOpacity
                                        key={c.id}
                                        style={[styles.exportOptionCard, { marginBottom: 6 }, isSel && { borderColor: '#1D4ED8', backgroundColor: '#EFF6FF' }]}
                                        onPress={() => { setReportPartyFilter(c.id); setIsReportFilterModalVisible(false); }}
                                    >
                                        <MaterialCommunityIcons name="account" size={20} color={isSel ? '#1D4ED8' : '#64748B'} style={{ marginRight: 10 }} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[{ fontSize: 14, fontWeight: '700', color: '#0F172A' }, isSel && { color: '#1D4ED8', fontWeight: '900' }]}>
                                                {c.name}
                                            </Text>
                                            {c.phone ? <Text style={{ fontSize: 11, color: '#64748B' }}>{c.phone}</Text> : null}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Edit Client Modal */}
            <Modal visible={isEditClientModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Edit Client Profile</Text>
                                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Update client details or opening balance</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsEditClientModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.formGroup}>
                                <Text style={styles.modalLabel}>Client / Company Name *</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. Ultratech Cement Plant"
                                    placeholderTextColor="#94A3B8"
                                    value={editClientName}
                                    onChangeText={setEditClientName}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.modalLabel}>Phone Number</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. 9876543210"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="phone-pad"
                                    value={editClientPhone}
                                    onChangeText={setEditClientPhone}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.modalLabel}>Site / Address</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. Raipur Plant, NH-6 Bypass"
                                    placeholderTextColor="#94A3B8"
                                    value={editClientAddress}
                                    onChangeText={setEditClientAddress}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.modalLabel}>Opening Balance (₹)</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="0.0"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="numeric"
                                    value={editClientOpeningBalance}
                                    onChangeText={setEditClientOpeningBalance}
                                />
                            </View>

                            <TouchableOpacity 
                                style={[styles.submitBtn, { backgroundColor: '#2563EB', marginTop: 18 }]} 
                                onPress={handleSaveEditedClient} 
                                activeOpacity={0.85}
                            >
                                <MaterialCommunityIcons name="check-bold" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                                <Text style={[styles.submitBtnText, { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }]}>Save Changes</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

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

                            {/* Client / Customer Selection (Optional) */}
                            <View style={styles.formGroup}>
                                <Text style={styles.modalLabel}>Select Client / Customer (Optional)</Text>
                                <TouchableOpacity 
                                    style={styles.staffSelectTrigger} 
                                    onPress={() => setIsClientPickerVisible(true)}
                                    activeOpacity={0.75}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                        <MaterialCommunityIcons name="account-tie" size={20} color="#64748B" />
                                        <Text style={selectedClientForTxn ? styles.staffSelectVal : styles.staffSelectPlaceholder}>
                                            {selectedClientForTxn ? selectedClientForTxn.name : "Select Client (Optional)"}
                                        </Text>
                                    </View>
                                    {selectedClientForTxn ? (
                                        <TouchableOpacity onPress={() => setSelectedClientForTxn(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                            <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
                                        </TouchableOpacity>
                                    ) : (
                                        <MaterialCommunityIcons name="chevron-down" size={18} color="#64748B" />
                                    )}
                                </TouchableOpacity>
                            </View>

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
                            <View>
                                <Text style={styles.pickerModalTitle}>Select Staff Member</Text>
                                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Tap to view work hours & process payout</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsStaffPickerVisible(false)}>
                                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 320 }}>
                            {staffList.filter(u => u.role !== 'ADMIN').map(u => (
                                <TouchableOpacity 
                                    key={u.id} 
                                    style={styles.staffOptionRow}
                                    onPress={() => {
                                        setIsStaffPickerVisible(false);
                                        setIsModalVisible(false);
                                        // Navigate to full staff profile with working hours, pending advances & direct payout
                                        navigation.navigate('UserLedger', { 
                                            user: u, 
                                            userToken, 
                                            dailyLedgerEntries: ledgerData,
                                            sites: selectedSite ? [selectedSite] : []
                                        });
                                    }}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.staffOptionName}>{u.full_name || u.username}</Text>
                                        <Text style={styles.staffOptionSub}>@{u.username} • {u.designation || u.role}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#2563EB' }}>View Hours & Pay</Text>
                                        <MaterialCommunityIcons name="arrow-right" size={14} color="#2563EB" />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Client Dropdown Picker Modal with Search & Add Client Option */}
            <Modal visible={isClientPickerVisible} transparent animationType="fade">
                <TouchableOpacity style={styles.pickerModalOverlay} activeOpacity={1} onPress={() => setIsClientPickerVisible(false)}>
                    <View style={styles.pickerModalContent} onStartShouldSetResponder={() => true}>
                        <View style={styles.pickerModalHeader}>
                            <View>
                                <Text style={styles.pickerModalTitle}>Select Client / Customer</Text>
                                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Choose a client or register a new one</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsClientPickerVisible(false)}>
                                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Search Bar */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, height: 40, marginVertical: 10 }}>
                            <MaterialCommunityIcons name="magnify" size={18} color="#64748B" style={{ marginRight: 6 }} />
                            <TextInput 
                                style={{ flex: 1, fontSize: 13, color: '#0F172A' }}
                                placeholder="Search client name or phone..."
                                placeholderTextColor="#94A3B8"
                                value={clientSearchText}
                                onChangeText={setClientSearchText}
                            />
                            {clientSearchText ? (
                                <TouchableOpacity onPress={() => setClientSearchText('')}>
                                    <MaterialCommunityIcons name="close-circle" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        {/* "+ Add New Client" Action Button directly inside the dropdown */}
                        <TouchableOpacity 
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingVertical: 10, borderRadius: 10, marginBottom: 10 }}
                            onPress={() => {
                                setIsClientPickerVisible(false);
                                setIsAddClientModalVisible(true);
                            }}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="account-plus" size={18} color="#2563EB" />
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#2563EB' }}>+ Add New Client</Text>
                        </TouchableOpacity>

                        {/* Saved Clients List */}
                        <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                            {filteredClients.length === 0 ? (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>No matching clients found.</Text>
                                </View>
                            ) : (
                                filteredClients.map(c => {
                                    const metrics = getClientMetrics(c.id, c.opening_balance);
                                    const isSel = selectedClientForTxn?.id === c.id;
                                    return (
                                        <TouchableOpacity 
                                            key={c.id} 
                                            style={[styles.staffOptionRow, isSel && { backgroundColor: '#F0FDF4', borderColor: '#86EFAC', borderWidth: 1 }]}
                                            onPress={() => {
                                                setSelectedClientForTxn(c);
                                                setIsClientPickerVisible(false);
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.staffOptionName, isSel && { color: '#166534' }]}>{c.name}</Text>
                                                <Text style={styles.staffOptionSub}>
                                                    {c.phone ? `📞 ${c.phone}` : 'No Phone'} {c.address ? `• ${c.address}` : ''}
                                                </Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={{ fontSize: 12, fontWeight: '800', color: metrics.pending > 0 ? '#DC2626' : metrics.pending < 0 ? '#16A34A' : '#64748B' }}>
                                                    {metrics.pending > 0 ? `₹${metrics.pending.toLocaleString()} Due` : metrics.pending < 0 ? `₹${Math.abs(metrics.pending).toLocaleString()} Adv` : '₹0'}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Freight Payment Collection Modal */}
            <Modal visible={!!selectedTripForPayment} transparent animationType="slide">
                <View style={styles.freightModalOverlay}>
                    <View style={styles.freightModalCard}>
                        <View style={styles.pickerModalHeader}>
                            <View>
                                <Text style={styles.pickerModalTitle}>Record Freight Payment</Text>
                                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Collect party / bilti balance payment</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedTripForPayment(null)}>
                                <MaterialCommunityIcons name="close" size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        {selectedTripForPayment && (
                            <View style={styles.freightTripSummaryBox}>
                                <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                                    Vehicle: {selectedTripForPayment.vehicle_number} (Trip #{selectedTripForPayment.id})
                                </Text>
                                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                                    Total Bhada: ₹{selectedTripForPayment.bhada?.toLocaleString()} | Received: ₹{selectedTripForPayment.advance_freight_received?.toLocaleString()}
                                </Text>
                                <Text style={{ fontSize: 14, fontWeight: '900', color: '#DC2626', marginTop: 4 }}>
                                    Pending Balance: ₹{selectedTripForPayment.pending_freight?.toLocaleString()}
                                </Text>
                            </View>
                        )}

                        <View style={styles.formGroup}>
                            <Text style={styles.modalLabel}>Payment Amount (₹) *</Text>
                            <View style={styles.amountInputRow}>
                                <Text style={styles.currencyPrefix}>₹</Text>
                                <TextInput
                                    style={styles.amountInput}
                                    placeholder="0"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="numeric"
                                    value={freightPaymentAmount}
                                    onChangeText={setFreightPaymentAmount}
                                />
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.modalLabel}>Payment Mode</Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {['CASH', 'BANK', 'UPI'].map(m => (
                                    <TouchableOpacity
                                        key={m}
                                        style={[styles.freightModeChip, freightPaymentMode === m && styles.freightModeChipActive]}
                                        onPress={() => setFreightPaymentMode(m)}
                                    >
                                        <Text style={[styles.freightModeText, freightPaymentMode === m && styles.freightModeTextActive]}>
                                            {m}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.modalLabel}>Bilti Ref / Party Notes</Text>
                            <TextInput
                                style={[styles.modalInput, { height: 60 }]}
                                placeholder="e.g. Unloading settlement, Cheque/UTR #..."
                                placeholderTextColor="#94A3B8"
                                value={freightPaymentNotes}
                                onChangeText={setFreightPaymentNotes}
                            />
                        </View>

                        <TouchableOpacity 
                            style={[styles.saveBtn, { backgroundColor: '#16A34A', marginTop: 6 }]} 
                            onPress={handleRecordFreightPayment}
                            activeOpacity={0.85}
                        >
                            <MaterialCommunityIcons name="check-circle" size={18} color="#FFFFFF" />
                            <Text style={styles.saveBtnText}>Save & Credit Daily Ledger</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#F8FAFC', 
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

    // --- FREIGHT LEDGER STYLES ---
    topSegmentContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 10,
        alignItems: 'center'
    },
    topSegmentBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 6
    },
    topSegmentBtnActive: {
        backgroundColor: '#EFF6FF',
        borderColor: '#2563EB'
    },
    topSegmentText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B'
    },
    topSegmentTextActive: {
        color: '#2563EB'
    },
    miniPendingPill: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10
    },
    miniPendingPillText: {
        color: '#DC2626',
        fontSize: 10,
        fontWeight: '800'
    },

    clientCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 13,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        height: '100%',
        justifyContent: 'space-between',
    },
    clientCardFluid: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        marginBottom: 12,
    },
    reorderToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    reorderToggleBtnActive: {
        backgroundColor: '#2563EB',
        borderColor: '#2563EB',
    },
    reorderToggleBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#2563EB',
    },
    reorderCompactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingHorizontal: 14,
        height: 56,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    clientCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    clientCardName: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
        lineHeight: 20,
    },
    clientCardSub: {
        fontSize: 12,
        color: '#64748B',
    },
    clientSubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        marginBottom: 4,
    },
    addressChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
    },
    addressChipText: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600',
        maxWidth: 130,
    },
    clientBalanceBadge: {
        alignItems: 'flex-end',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        minWidth: 85,
    },
    clientBalanceDue: {
        backgroundColor: '#FEE2E2',
        borderWidth: 1,
        borderColor: '#FECACA'
    },
    clientBalanceAdv: {
        backgroundColor: '#DCFCE7',
        borderWidth: 1,
        borderColor: '#BBF7D0'
    },
    clientBalanceZero: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    clientBalanceLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 0.5
    },
    clientBalanceVal: {
        fontSize: 13,
        fontWeight: '900',
        marginTop: 1,
    },
    clientStatsRow: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        marginBottom: 4,
    },
    clientStatCol: {
        flex: 1,
        alignItems: 'center'
    },
    clientStatLabel: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '600',
        marginBottom: 2
    },
    clientStatVal: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A'
    },
    clientStatDivider: {
        width: 1,
        backgroundColor: '#E2E8F0',
        marginVertical: 2
    },
    clientActionRow: {
        flexDirection: 'row',
        gap: 10
    },
    clientPassbookBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#EFF6FF',
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#DBEAFE'
    },
    clientPassbookBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#2563EB'
    },
    clientEntryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#0F172A',
        paddingVertical: 10,
        borderRadius: 10
    },
    clientEntryBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF'
    },

    freightFilterBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 8,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    freightFilterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#F1F5F9'
    },
    freightFilterChipActive: {
        backgroundColor: '#0F172A'
    },
    freightFilterText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B'
    },
    freightFilterTextActive: {
        color: '#FFFFFF'
    },
    freightMetricsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12
    },
    freightMetricCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: 10,
        borderRadius: 10,
        borderLeftWidth: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 1
    },
    freightMetricLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 0.5
    },
    freightMetricVal: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0F172A',
        marginTop: 4
    },
    freightMetricSub: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 2
    },
    progressContainer: {
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6
    },
    progressLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B'
    },
    progressPercent: {
        fontSize: 12,
        fontWeight: '900',
        color: '#059669'
    },
    progressBarTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#F1F5F9',
        overflow: 'hidden'
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#10B981',
        borderRadius: 3
    },
    freightCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 1
    },
    freightCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC'
    },
    freightTruckIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    freightVehicle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A'
    },
    freightTripId: {
        fontSize: 11,
        color: '#94A3B8'
    },
    freightStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    },
    freightStatusBadgeText: {
        fontSize: 10,
        fontWeight: '800'
    },
    freightRouteRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    freightRouteText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155'
    },
    freightMaterialText: {
        fontSize: 11,
        color: '#64748B'
    },
    freightAmountsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#F8FAFC',
        marginBottom: 10
    },
    amountCol: {
        flex: 1,
        alignItems: 'center'
    },
    colLabel: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '600'
    },
    colVal: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
        marginTop: 2
    },
    collectPaymentBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#16A34A',
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6
    },
    collectPaymentBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700'
    },
    freightModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20
    },
    freightModalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20
    },
    freightTripSummaryBox: {
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16
    },
    freightModeChip: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: '#F1F5F9'
    },
    freightModeChipActive: {
        backgroundColor: '#0F172A'
    },
    freightModeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B'
    },
    freightModeTextActive: {
        color: '#FFFFFF'
    },

    /* Submit Button (Vibrant Solid Color) */
    submitBtn: {
        backgroundColor: '#0F172A',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
        marginTop: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
        elevation: 3,
    },
    submitBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.3,
    },

    /* Phone Call Chip */
    phoneChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    phoneChipText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#2563EB',
    },

    /* Client Action Icon Buttons (Edit / Delete) */
    clientIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* Client PDF Button */
    clientPdfBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
    },
    clientPdfBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#DC2626',
    },

    passbookPdfBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    passbookPdfBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#DC2626',
    },

    /* Top Executive Client Stats Block */
    clientStatsBlock: {
        marginBottom: 16,
    },
    clientStatsDualRow: {
        flexDirection: 'row',
        gap: 10,
    },
    clientStatsCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    clientStatsCardLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 0.4,
    },
    clientStatsHindiLabel: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#94A3B8',
        marginTop: 1,
    },
    clientStatsCardVal: {
        fontSize: 17,
        fontWeight: '900',
        marginTop: 4,
        letterSpacing: -0.3,
    },
    clientStatsCardSub: {
        fontSize: 9.5,
        color: '#64748B',
        marginTop: 3,
        lineHeight: 12,
    },
    clientNetBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginTop: 8,
    },
    clientNetBarText: {
        fontSize: 12,
        color: '#334155',
        fontWeight: '600',
    },
    clientNetBarRight: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },

    /* Client Txn Modal Type Switcher */
    clientTypeSwitcher: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    clientTypeBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
    },
    clientTypeBtnBilledActive: {
        backgroundColor: '#DC2626',
        borderColor: '#DC2626',
    },
    clientTypeBtnReceivedActive: {
        backgroundColor: '#16A34A',
        borderColor: '#16A34A',
    },
    clientTypeBtnAdvanceActive: {
        backgroundColor: '#0284C7',
        borderColor: '#0284C7',
    },
    clientTypeBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#475569',
        marginTop: 4,
        textAlign: 'center',
    },
    clientTypeBtnTextActive: {
        color: '#FFFFFF',
    },
    clientTypeBtnSub: {
        fontSize: 9.5,
        fontWeight: '600',
        color: '#94A3B8',
        marginTop: 1,
        textAlign: 'center',
    },
    clientTypeBtnSubActive: {
        color: 'rgba(255,255,255,0.85)',
    },

    /* Client Khata Filter Highlights */
    clientStatsCardActiveDue: {
        borderWidth: 2,
        borderColor: '#EF4444',
        backgroundColor: '#FEF2F2',
    },
    clientStatsCardActiveAdv: {
        borderWidth: 2,
        borderColor: '#10B981',
        backgroundColor: '#F0FDF4',
    },
    clientNetBarActive: {
        borderWidth: 2,
        borderColor: '#2563EB',
        backgroundColor: '#EFF6FF',
    },
    statActiveBadge: {
        backgroundColor: '#EF4444',
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 2,
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    statActiveBadgeText: {
        color: '#FFFFFF',
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    clientFilterChipsRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 10,
    },
    clientFilterChip: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    clientFilterChipActive: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A',
    },
    clientFilterChipActiveDue: {
        backgroundColor: '#FEF2F2',
        borderColor: '#DC2626',
    },
    clientFilterChipActiveAdv: {
        backgroundColor: '#F0FDF4',
        borderColor: '#16A34A',
    },
    clientFilterChipActiveSettled: {
        backgroundColor: '#EFF6FF',
        borderColor: '#2563EB',
    },
    clientFilterChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    clientFilterChipTextActive: {
        color: '#FFFFFF',
    },
    clientFilterChipTextActiveDue: {
        color: '#DC2626',
    },
    clientFilterChipTextActiveAdv: {
        color: '#16A34A',
    },
    clientFilterChipTextActiveSettled: {
        color: '#2563EB',
    },

    /* Khatabahi Date-Wise Report Styles (matching khatabahi.jpeg) */
    khatabahiContainer: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    khatabahiHeader: {
        backgroundColor: '#0D47A1',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
    },
    khatabahiHeaderTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    khatabahiHeaderTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    khatabahiTabsRow: {
        flexDirection: 'row',
        marginTop: 14,
    },
    khatabahiTab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
    },
    khatabahiTabActive: {
        borderBottomWidth: 3,
        borderBottomColor: '#FFFFFF',
    },
    khatabahiTabText: {
        fontSize: 14,
        fontWeight: '800',
        color: 'rgba(255, 255, 255, 0.65)',
        letterSpacing: 0.8,
    },
    khatabahiTabTextActive: {
        color: '#FFFFFF',
    },
    khatabahiDateBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    khatabahiDateSelectorBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
    },
    khatabahiDateSelectorText: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#1D4ED8',
        letterSpacing: 0.4,
    },
    khatabahiFiltersBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 6,
        position: 'relative',
    },
    khatabahiFiltersBadge: {
        position: 'absolute',
        top: -6,
        right: 8,
        backgroundColor: '#10B981',
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
    },
    khatabahiFiltersBadgeText: {
        color: '#FFFFFF',
        fontSize: 8.5,
        fontWeight: '900',
    },
    khatabahiFiltersText: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#1D4ED8',
    },
    khatabahiEquationCard: {
        backgroundColor: '#EFF6FF',
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#DBEAFE',
    },
    khatabahiEquationCol: {
        alignItems: 'center',
        minWidth: 70,
    },
    khatabahiEquationLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
        marginBottom: 3,
    },
    khatabahiEquationVal: {
        fontSize: 16,
        fontWeight: '900',
    },
    khatabahiEquationOp: {
        fontSize: 20,
        fontWeight: '800',
        color: '#64748B',
    },
    khatabahiExpandCircle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#DBEAFE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    khatabahiTableHead: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        alignItems: 'center',
    },
    khatabahiTableHeadCol: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
    },
    khatabahiTableRow: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    khatabahiTableRowMain: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    khatabahiRowDate: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
    },
    khatabahiRowIn: {
        fontSize: 14,
        fontWeight: '800',
        color: '#16A34A',
        textAlign: 'center',
    },
    khatabahiRowOut: {
        fontSize: 14,
        fontWeight: '800',
        color: '#DC2626',
        textAlign: 'center',
    },
    khatabahiRowBal: {
        fontSize: 14,
        fontWeight: '800',
        textAlign: 'right',
    },
    khatabahiRowDetailsBox: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        padding: 10,
    },
    khatabahiBottomSticky: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 22,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    khatabahiDownloadBtn: {
        borderWidth: 1.8,
        borderColor: '#1D4ED8',
        borderRadius: 8,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#FFFFFF',
    },
    khatabahiDownloadText: {
        fontSize: 14,
        fontWeight: '900',
        color: '#1D4ED8',
        letterSpacing: 1,
    },

    /* PDF Viewer / Export Modal Styles */
    exportModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        justifyContent: 'flex-end',
    },
    exportModalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 32,
    },
    exportOptionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    exportOptionIconBox: {
        width: 44,
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    exportOptionTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0F172A',
    },
    exportOptionSub: {
        fontSize: 11.5,
        color: '#64748B',
        marginTop: 2,
    },
    passbookModePill: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    passbookModeText: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '700',
    }
});
