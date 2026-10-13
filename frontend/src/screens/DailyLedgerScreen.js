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

    // Client Dropdown Picker and Search States
    const [clientSearchText, setClientSearchText] = useState('');
    const [isClientPickerVisible, setIsClientPickerVisible] = useState(false);

    useEffect(() => {
        loadClientKhata();
    }, []);

    const loadClientKhata = async () => {
        try {
            const storedClients = await AsyncStorage.getItem(CLIENTS_STORAGE_KEY);
            const storedTxns = await AsyncStorage.getItem(CLIENTS_TXN_STORAGE_KEY);
            if (storedClients) {
                setClients(JSON.parse(storedClients));
            } else {
                const initial = [
                    { id: 'c1', name: 'Ultratech Cement Plant', phone: '9876543210', address: 'Raipur Plant Depot', opening_balance: 45000, created_at: new Date().toISOString() },
                    { id: 'c2', name: 'Shree Balaji Builders', phone: '9827012345', address: 'Main Ring Road Site', opening_balance: 0, created_at: new Date().toISOString() }
                ];
                setClients(initial);
                await AsyncStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(initial));
            }
            if (storedTxns) {
                setClientTransactions(JSON.parse(storedTxns));
            }
        } catch (e) {
            console.log('Error loading client khata:', e);
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

    const handleAddClient = async () => {
        if (!newClientName.trim()) {
            Alert.alert('Missing Name', 'Please enter client or company name.');
            return;
        }
        const newClient = {
            id: Date.now().toString(),
            name: newClientName.trim(),
            phone: newClientPhone.trim(),
            address: newClientAddress.trim(),
            opening_balance: parseFloat(newClientOpeningBalance) || 0,
            created_at: new Date().toISOString()
        };
        const updated = [newClient, ...clients];
        await saveClientsToStorage(updated);
        setNewClientName('');
        setNewClientPhone('');
        setNewClientAddress('');
        setNewClientOpeningBalance('');
        setIsAddClientModalVisible(false);
        Alert.alert('Client Added', 'Client "' + newClient.name + '" added to Khatabook.');
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
        const updated = clients.map(c => {
            if (c.id === clientToEdit.id) {
                return {
                    ...c,
                    name: editClientName.trim(),
                    phone: editClientPhone.trim(),
                    address: editClientAddress.trim(),
                    opening_balance: parseFloat(editClientOpeningBalance) || 0,
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
                        const updatedClients = clients.filter(c => c.id !== client.id);
                        const updatedTxns = clientTransactions.filter(t => t.client_id !== client.id);
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
        setSelectedClientForTxn(client || clients.find(c => c.id === txn.client_id));
        setEditingClientTxn(txn);
        setClientTxnType(txn.type || 'BILLED');
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

        if (editingClientTxn) {
            const updatedTxns = clientTransactions.map(t => {
                if (t.id === editingClientTxn.id) {
                    return {
                        ...t,
                        type: clientTxnType,
                        amount: amt,
                        date: clientTxnDate.toISOString().split('T')[0],
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

        const newTxn = {
            id: Date.now().toString(),
            client_id: selectedClientForTxn.id,
            type: clientTxnType,
            amount: amt,
            date: clientTxnDate.toISOString().split('T')[0],
            payment_mode: clientTxnMode,
            notes: clientTxnNotes.trim(),
            created_at: new Date().toISOString()
        };

        const updatedTxns = [newTxn, ...clientTransactions];
        await saveTxnsToStorage(updatedTxns);

        if (syncClientTxnToDaily && (clientTxnType === 'RECEIVED' || clientTxnType === 'ADVANCE')) {
            const dailyPayload = {
                transaction_type: 'INCOME',
                category: 'CLIENT_PAYMENT',
                amount: amt,
                description: 'Payment from ' + selectedClientForTxn.name + ' (' + clientTxnMode + ')' + (clientTxnNotes ? ': ' + clientTxnNotes : ''),
                date: clientTxnDate.toISOString().split('T')[0],
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
                    const updated = clientTransactions.filter(t => t.id !== txnId);
                    await saveTxnsToStorage(updated);
                }
            }
        ]);
    };

    const getClientMetrics = (clientId, openingBal = 0) => {
        const txns = clientTransactions.filter(t => t.client_id === clientId);
        const billed = txns.filter(t => t.type === 'BILLED').reduce((s, t) => s + (t.amount || 0), 0) + (openingBal || 0);
        const received = txns.filter(t => t.type === 'RECEIVED' || t.type === 'ADVANCE').reduce((s, t) => s + (t.amount || 0), 0);
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

    const exportClientPdf = async (client) => {
        if (!client) return;
        try {
            const metrics = getClientMetrics(client.id, client.opening_balance);
            const txns = clientTransactions
                .filter(t => t.client_id === client.id)
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            const currentDateStr = new Date().toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });

            let runningBal = client.opening_balance || 0;
            let rowsHtml = '';

            if (client.opening_balance && client.opening_balance > 0) {
                rowsHtml += `
                    <tr style="background: #F8FAFC; font-weight: 600;">
                        <td>-</td>
                        <td><strong>Opening Balance</strong></td>
                        <td>-</td>
                        <td style="color: #475569;">INITIAL</td>
                        <td style="text-align: right; color: #DC2626;">₹${client.opening_balance.toLocaleString('en-IN')}</td>
                        <td style="text-align: right; color: #64748B;">-</td>
                        <td style="text-align: right; font-weight: 700; color: #DC2626;">₹${runningBal.toLocaleString('en-IN')}</td>
                    </tr>
                `;
            }

            txns.forEach((t) => {
                const isDebit = t.type === 'BILLED';
                const debitAmt = isDebit ? t.amount : 0;
                const creditAmt = !isDebit ? t.amount : 0;
                runningBal += (debitAmt - creditAmt);

                rowsHtml += `
                    <tr>
                        <td style="white-space: nowrap;">${t.date || '-'}</td>
                        <td>${t.notes || (isDebit ? 'Material / Freight Billed' : 'Payment Received')}</td>
                        <td><span class="mode-tag">${t.payment_mode || 'CASH'}</span></td>
                        <td><span class="${isDebit ? 'badge-debit' : 'badge-credit'}">${t.type}</span></td>
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

            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Client Statement - ${client.name}</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #0F172A; background: #fff; line-height: 1.4; }
                        .header-box { border-bottom: 3px solid #0F172A; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
                        .company-name { font-size: 22px; font-weight: 900; color: #0F172A; letter-spacing: 0.5px; }
                        .company-tag { font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase; margin-top: 2px; }
                        .doc-title { text-align: right; }
                        .doc-title h2 { margin: 0; font-size: 16px; font-weight: 800; color: #2563EB; }
                        .doc-title span { font-size: 11px; color: #64748B; }

                        .client-hero { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; gap: 16px; }
                        .client-info h3 { margin: 0 0 4px 0; font-size: 18px; font-weight: 800; color: #0F172A; }
                        .client-info p { margin: 2px 0; font-size: 12px; color: #475569; }
                        
                        .balance-box { background: #FFFFFF; border: 2px solid ${netStatusColor}; border-radius: 8px; padding: 12px 16px; text-align: right; min-width: 180px; }
                        .bal-label { font-size: 10px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; }
                        .bal-val { font-size: 18px; font-weight: 900; color: ${netStatusColor}; margin-top: 2px; }

                        .summary-grid { display: flex; gap: 12px; margin-bottom: 20px; }
                        .summary-card { flex: 1; background: #F1F5F9; border-radius: 8px; padding: 10px 14px; }
                        .sc-label { font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; }
                        .sc-val { font-size: 15px; font-weight: 800; margin-top: 3px; color: #0F172A; }

                        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
                        th { background: #0F172A; color: #FFFFFF; text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
                        td { padding: 8px 10px; border-bottom: 1px solid #E2E8F0; }
                        .badge-debit { background: #FEE2E2; color: #DC2626; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
                        .badge-credit { background: #DCFCE7; color: #16A34A; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
                        .mode-tag { background: #F1F5F9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }

                        .footer-note { margin-top: 40px; border-top: 1px dashed #CBD5E1; padding-top: 14px; display: flex; justify-content: space-between; font-size: 11px; color: #94A3B8; }
                        .sign-box { margin-top: 30px; text-align: right; }
                        .sign-line { display: inline-block; width: 160px; border-bottom: 1px solid #000; margin-bottom: 4px; }
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

            Alert.alert(
                `PDF Statement: ${client.name}`,
                'Choose how you want to export this client statement:',
                [
                    {
                        text: 'Save as PDF / Print',
                        onPress: async () => {
                            try {
                                await Print.printAsync({ html: htmlContent });
                            } catch (err) {
                                Alert.alert('Print Error', err.message || 'Failed to print PDF');
                            }
                        }
                    },
                    {
                        text: 'Share PDF File',
                        onPress: async () => {
                            try {
                                const { uri: tempUri } = await Print.printToFileAsync({ html: htmlContent });
                                const cleanName = (client.name || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
                                const fileName = `Statement_${cleanName}_${Date.now()}.pdf`;
                                const destUri = `${FileSystem.documentDirectory}${fileName}`;
                                await FileSystem.copyAsync({ from: tempUri, to: destUri });
                                await Sharing.shareAsync(destUri, {
                                    mimeType: 'application/pdf',
                                    dialogTitle: `${client.name} - Khatabook Statement`
                                });
                            } catch (shareErr) {
                                console.log('Direct share fallback to print:', shareErr);
                                await Print.printAsync({ html: htmlContent });
                            }
                        }
                    },
                    { text: 'Cancel', style: 'cancel' }
                ]
            );
        } catch (e) {
            console.error('PDF export error:', e);
            Alert.alert('Export Error', 'Failed to generate PDF statement.');
        }
    };
    
    // Active View: Cashflow vs Freight Ledger
    const filteredClients = clients.filter(c => {
        if (!clientSearchText.trim()) return true;
        const q = clientSearchText.toLowerCase();
        return (c.name && c.name.toLowerCase().includes(q)) || (c.phone && c.phone.includes(q));
    });

    // Active View: Cashflow vs Client Khata vs Freight Ledger
    const [activeView, setActiveView] = useState('CASHFLOW'); // 'CASHFLOW', 'CLIENTS', 'FREIGHT'
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
                        {/* Top Executive Stats Block */}
                        <View style={styles.clientStatsBlock}>
                            <View style={styles.clientStatsDualRow}>
                                {/* Receivable Card */}
                                <View style={[styles.clientStatsCard, { borderLeftColor: '#EF4444' }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Text style={styles.clientStatsCardLabel}>TOTAL RECEIVABLE</Text>
                                        <View style={[styles.statIconBadge, { backgroundColor: '#FEE2E2' }]}>
                                            <MaterialCommunityIcons name="arrow-down-left" size={14} color="#DC2626" />
                                        </View>
                                    </View>
                                    <Text style={styles.clientStatsHindiLabel}>मार्केट से लेना बाकी</Text>
                                    <Text style={[styles.clientStatsCardVal, { color: '#DC2626' }]} numberOfLines={1}>
                                        ₹{Math.round(clientStats.totalReceivable).toLocaleString()}
                                    </Text>
                                    <Text style={styles.clientStatsCardSub}>{clientStats.dueCount} parties with pending dues</Text>
                                </View>

                                {/* Customer Advance Card */}
                                <View style={[styles.clientStatsCard, { borderLeftColor: '#10B981' }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Text style={styles.clientStatsCardLabel}>CUSTOMER ADVANCE</Text>
                                        <View style={[styles.statIconBadge, { backgroundColor: '#DCFCE7' }]}>
                                            <MaterialCommunityIcons name="hand-coin" size={14} color="#16A34A" />
                                        </View>
                                    </View>
                                    <Text style={styles.clientStatsHindiLabel}>अग्रिम प्राप्त / जमा</Text>
                                    <Text style={[styles.clientStatsCardVal, { color: '#059669' }]} numberOfLines={1}>
                                        ₹{Math.round(clientStats.totalAdvance).toLocaleString()}
                                    </Text>
                                    <Text style={styles.clientStatsCardSub}>{clientStats.advanceCount} parties in credit advance</Text>
                                </View>
                            </View>

                            {/* Net Summary Bar */}
                            <View style={styles.clientNetBar}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                    <MaterialCommunityIcons name="scale-balance" size={15} color="#64748B" />
                                    <Text style={styles.clientNetBarText} numberOfLines={1}>
                                        Net: <Text style={{ fontWeight: '900', color: (clientStats.totalReceivable - clientStats.totalAdvance) >= 0 ? '#DC2626' : '#16A34A' }}>
                                            ₹{Math.abs(clientStats.totalReceivable - clientStats.totalAdvance).toLocaleString()} {(clientStats.totalReceivable - clientStats.totalAdvance) >= 0 ? 'Receivable' : 'Advance'}
                                        </Text>
                                    </Text>
                                </View>
                                <Text style={styles.clientNetBarRight}>{clients.length} Clients ({clientStats.settledCount} Settled)</Text>
                            </View>
                        </View>

                        {/* Client Cards List */}
                        {filteredClients.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <MaterialCommunityIcons name="account-group-outline" size={48} color="#94A3B8" />
                                <Text style={styles.emptyTitle}>No Clients Found</Text>
                                <Text style={styles.emptySub}>Add a new client to start tracking their Khatabook ledger.</Text>
                            </View>
                        ) : (
                            <DraggableCardList
                                items={filteredClients}
                                itemHeight={225}
                                gap={12}
                                paddingHorizontal={0}
                                storageKey="@fleet_client_khata_clients_order_v2"
                                scrollViewRef={clientScrollViewRef}
                                scrollYRef={clientScrollYRef}
                                dragHint="Hold & drag card to arrange order"
                                onOrderChange={(reordered) => saveClientsToStorage(reordered)}
                                renderItem={(c) => {
                                    const metrics = getClientMetrics(c.id, c.opening_balance);
                                    const isDue = metrics.pending > 0;
                                    const isAdv = metrics.pending < 0;
                                    return (
                                        <View key={c.id} style={styles.clientCard}>
                                            {/* Top Row: Full Client Name with Drag Indicator & Action Icons */}
                                            <View style={styles.clientCardHeader}>
                                                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginRight: 8 }}>
                                                    <MaterialCommunityIcons name="drag-horizontal-variant" size={18} color="#94A3B8" style={{ marginTop: 2 }} />
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
                                }}
                            />
                        )}
                    </ScrollView>
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
                                style={[styles.submitBtn, { backgroundColor: '#0F172A' }]} 
                                onPress={handleAddClient} 
                                activeOpacity={0.85}
                            >
                                <MaterialCommunityIcons name="account-plus" size={18} color="#FFFFFF" />
                                <Text style={styles.submitBtnText}>Save Client</Text>
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
                    <View style={[styles.modalContent, { maxHeight: '90%' }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={styles.modalTitle}>Khata Passbook</Text>
                                <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 2 }}>
                                    {selectedClientForStatement ? selectedClientForStatement.name : ''}
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                {selectedClientForStatement && (
                                    <TouchableOpacity 
                                        style={styles.passbookPdfBtn}
                                        onPress={() => exportClientPdf(selectedClientForStatement)}
                                        activeOpacity={0.8}
                                    >
                                        <MaterialCommunityIcons name="file-pdf-box" size={18} color="#DC2626" />
                                        <Text style={styles.passbookPdfBtnText}>Export PDF</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={() => setIsClientStatementModalVisible(false)}>
                                    <MaterialCommunityIcons name="close" size={24} color="#0F172A" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {selectedClientForStatement ? (() => {
                            const m = getClientMetrics(selectedClientForStatement.id, selectedClientForStatement.opening_balance);
                            const txns = clientTransactions.filter(t => t.client_id === selectedClientForStatement.id);

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
                                            <Text style={{ fontSize: 11, color: '#64748B' }}>Total Billed: ₹{m.billed.toLocaleString()}</Text>
                                            <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '700' }}>Total Paid: ₹{m.received.toLocaleString()}</Text>
                                        </View>
                                    </View>

                                    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                                        {selectedClientForStatement.opening_balance > 0 && (
                                            <View style={styles.passbookRow}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.passbookDate}>Previous Balance</Text>
                                                    <Text style={styles.passbookNote}>Opening Khata Balance</Text>
                                                </View>
                                                <Text style={[styles.passbookAmt, { color: '#DC2626' }]}>+ ₹{selectedClientForStatement.opening_balance.toLocaleString()}</Text>
                                            </View>
                                        )}

                                        {txns.length === 0 && (!selectedClientForStatement.opening_balance || selectedClientForStatement.opening_balance === 0) ? (
                                            <Text style={{ textAlign: 'center', color: '#94A3B8', marginVertical: 30 }}>No transactions recorded yet.</Text>
                                        ) : (
                                            txns.map(t => {
                                                const isDebit = t.type === 'BILLED';
                                                return (
                                                    <View key={t.id} style={styles.passbookRow}>
                                                        <View style={{ flex: 1 }}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                                <Text style={styles.passbookDate}>{t.date}</Text>
                                                                <View style={[styles.passbookTypePill, { backgroundColor: isDebit ? '#FEF2F2' : '#F0FDF4' }]}>
                                                                    <Text style={[styles.passbookTypePillText, { color: isDebit ? '#DC2626' : '#16A34A' }]}>
                                                                        {t.type}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                            {t.notes ? <Text style={styles.passbookNote}>{t.notes}</Text> : null}
                                                            <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>Mode: {t.payment_mode}</Text>
                                                        </View>

                                                        <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                                                            <Text style={[styles.passbookAmt, { color: isDebit ? '#DC2626' : '#16A34A' }]}>
                                                                {isDebit ? '+ ' : '- '}₹{t.amount.toLocaleString()}
                                                            </Text>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
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
                                            })
                                        )}
                                    </ScrollView>
                                </View>
                            );
                        })() : null}
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
                                style={[styles.submitBtn, { backgroundColor: '#0F172A' }]} 
                                onPress={handleSaveEditedClient} 
                                activeOpacity={0.85}
                            >
                                <MaterialCommunityIcons name="check-bold" size={18} color="#FFFFFF" />
                                <Text style={styles.submitBtnText}>Save Changes</Text>
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
    }
});
