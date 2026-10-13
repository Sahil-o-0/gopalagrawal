import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, StatusBar, Platform, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { AuthContext } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { API_BASE_URL } from '../config';
import { checkAndTriggerAutomatedAlerts } from '../context/NotificationService';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function FinancialReportScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 36 : 20);

  const { userToken } = useContext(AuthContext);
  const { selectedSite } = useSite();

  const currentDate = new Date();
  const [period, setPeriod] = useState('monthly'); // 'monthly' | 'yearly'
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1); // 1-12

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [reportData, setReportData] = useState(null);
  const [alertsData, setAlertsData] = useState(null);
  const [showAlertsList, setShowAlertsList] = useState(false);

  useEffect(() => {
    fetchFinancialReport();
    loadAlerts();
  }, [period, year, month, selectedSite?.id]);

  const loadAlerts = async () => {
    try {
      const res = await checkAndTriggerAutomatedAlerts(userToken, selectedSite?.id);
      setAlertsData(res);
    } catch (e) {
      console.log('Error loading alerts', e);
    }
  };

  const fetchFinancialReport = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        period,
        year: year.toString(),
        ...(period === 'monthly' ? { month: month.toString() } : {}),
        ...(selectedSite?.id ? { site_id: selectedSite.id.toString() } : {})
      });

      const res = await fetch(`${API_BASE_URL}/reports/financial-dashboard?${params.toString()}`, {
        headers: { 
          Authorization: `Bearer ${userToken}`,
          'bypass-tunnel-reminder': 'true'
        }
      });

      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      } else {
        const err = await res.json();
        Alert.alert('Error', err.detail || 'Failed to load financial dashboard');
      }
    } catch (error) {
      console.error('Fetch financial report error', error);
      Alert.alert('Network Error', 'Could not reach reporting server.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handlePrev = () => {
    if (period === 'monthly') {
      if (month === 1) {
        setMonth(12);
        setYear(y => y - 1);
      } else {
        setMonth(m => m - 1);
      }
    } else {
      setYear(y => y - 1);
    }
  };

  const handleNext = () => {
    if (period === 'monthly') {
      if (month === 12) {
        setMonth(1);
        setYear(y => y + 1);
      } else {
        setMonth(m => m + 1);
      }
    } else {
      setYear(y => y + 1);
    }
  };

  // One-Click PDF Generation & Sharing
  const exportPDFReport = async () => {
    if (!reportData) return;
    try {
      setIsExporting(true);

      const periodLabel = period === 'monthly' 
        ? `${MONTH_NAMES[month - 1]} ${year}` 
        : `Annual Report ${year}`;
      
      const siteLabel = selectedSite ? selectedSite.name : 'All Fleet Operational Sites';
      const summary = reportData.summary;
      const expenses = reportData.expense_breakdown;
      const freight = reportData.freight_metrics;
      const generatedAt = new Date().toLocaleString('en-IN');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${periodLabel} Financial Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1E293B; background: #fff; }
            .header-table { width: 100%; border-bottom: 3px solid #2563EB; padding-bottom: 12px; margin-bottom: 20px; }
            .brand-title { font-size: 24px; font-weight: 900; color: #1E3A8A; margin: 0; }
            .brand-sub { font-size: 13px; color: #64748B; margin-top: 4px; }
            .report-badge { text-align: right; }
            .badge-title { font-size: 18px; font-weight: 800; color: #2563EB; }
            .badge-site { font-size: 13px; color: #475569; }

            .hero-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 18px; margin-bottom: 24px; display: flex; justify-content: space-between; }
            .hero-stat { text-align: center; flex: 1; }
            .hero-label { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; }
            .hero-val { font-size: 20px; font-weight: 900; margin-top: 4px; }
            .val-profit { color: ${summary.net_profit >= 0 ? '#059669' : '#DC2626'}; }
            .val-earn { color: #2563EB; }
            .val-exp { color: #D97706; }

            .section-title { font-size: 14px; font-weight: 800; color: #0F172A; text-transform: uppercase; margin-bottom: 10px; border-left: 4px solid #2563EB; padding-left: 8px; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            th { background: #F1F5F9; text-align: left; padding: 10px; font-size: 12px; color: #475569; border-bottom: 2px solid #CBD5E1; }
            td { padding: 10px; font-size: 13px; border-bottom: 1px solid #E2E8F0; }
            .col-right { text-align: right; }
            .row-total { background: #F8FAFC; font-weight: 800; }

            .footer { margin-top: 40px; border-top: 1px dashed #CBD5E1; padding-top: 16px; display: flex; justify-content: space-between; font-size: 11px; color: #94A3B8; }
            .signature-box { margin-top: 30px; text-align: right; }
            .signature-line { display: inline-block; width: 180px; border-bottom: 1px solid #000; margin-bottom: 6px; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td>
                <div class="brand-title">GOPAL AGRAWAL FLEET & LOGISTICS</div>
                <div class="brand-sub">Fleet Operations, Workforce & Financial Management</div>
              </td>
              <td class="report-badge">
                <div class="badge-title">${periodLabel}</div>
                <div class="badge-site">Site: ${siteLabel}</div>
              </td>
            </tr>
          </table>

          <!-- Executive Summary -->
          <div class="hero-card">
            <div class="hero-stat">
              <div class="hero-label">Total Earnings</div>
              <div class="hero-val val-earn">₹${summary.total_earnings.toLocaleString('en-IN')}</div>
            </div>
            <div class="hero-stat" style="border-left: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0;">
              <div class="hero-label">Total Expenses</div>
              <div class="hero-val val-exp">₹${summary.total_expenses.toLocaleString('en-IN')}</div>
            </div>
            <div class="hero-stat">
              <div class="hero-label">Net Profit (${summary.profit_margin_percent}%)</div>
              <div class="hero-val val-profit">₹${summary.net_profit.toLocaleString('en-IN')}</div>
            </div>
          </div>

          <!-- Expense Breakdown Table -->
          <div class="section-title">Operational Expense Breakdown</div>
          <table>
            <thead>
              <tr>
                <th>Expense Head</th>
                <th>Category</th>
                <th class="col-right">Amount (₹)</th>
                <th class="col-right">Share of Expense</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Fuel & Diesel</strong></td>
                <td>Vehicle Operations</td>
                <td class="col-right">₹${expenses.diesel.toLocaleString('en-IN')}</td>
                <td class="col-right">${summary.total_expenses > 0 ? ((expenses.diesel / summary.total_expenses) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td><strong>Machinery & Vehicle Maintenance</strong></td>
                <td>Repairs & Overhaul</td>
                <td class="col-right">₹${expenses.maintenance.toLocaleString('en-IN')}</td>
                <td class="col-right">${summary.total_expenses > 0 ? ((expenses.maintenance / summary.total_expenses) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td><strong>Staff Salaries & Wages</strong></td>
                <td>Human Resources</td>
                <td class="col-right">₹${expenses.salary.toLocaleString('en-IN')}</td>
                <td class="col-right">${summary.total_expenses > 0 ? ((expenses.salary / summary.total_expenses) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td><strong>Staff Advances Disbursed</strong></td>
                <td>Employee Advances</td>
                <td class="col-right">₹${expenses.advance.toLocaleString('en-IN')}</td>
                <td class="col-right">${summary.total_expenses > 0 ? ((expenses.advance / summary.total_expenses) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td><strong>Vehicle EMI & Financier Installments</strong></td>
                <td>Capital Assets</td>
                <td class="col-right">₹${expenses.emi.toLocaleString('en-IN')}</td>
                <td class="col-right">${summary.total_expenses > 0 ? ((expenses.emi / summary.total_expenses) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td><strong>Office, Site & Miscellaneous</strong></td>
                <td>Overhead</td>
                <td class="col-right">₹${expenses.other.toLocaleString('en-IN')}</td>
                <td class="col-right">${summary.total_expenses > 0 ? ((expenses.other / summary.total_expenses) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr class="row-total">
                <td colspan="2"><strong>TOTAL OPERATIONAL EXPENDITURE</strong></td>
                <td class="col-right"><strong>₹${summary.total_expenses.toLocaleString('en-IN')}</strong></td>
                <td class="col-right"><strong>100.0%</strong></td>
              </tr>
            </tbody>
          </table>

          <!-- Freight & Trips Summary -->
          <div class="section-title">Freight Accounting & Logistics Ledger</div>
          <table>
            <thead>
              <tr>
                <th>Freight Metric</th>
                <th class="col-right">Values</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Bilti / Freight Billed</td>
                <td class="col-right"><strong>₹${freight.total_billed.toLocaleString('en-IN')}</strong></td>
              </tr>
              <tr>
                <td>Advance & Collected Freight</td>
                <td class="col-right" style="color: #059669;"><strong>₹${freight.total_received.toLocaleString('en-IN')}</strong></td>
              </tr>
              <tr>
                <td>Outstanding / Pending Balance</td>
                <td class="col-right" style="color: #DC2626;"><strong>₹${freight.total_pending.toLocaleString('en-IN')}</strong></td>
              </tr>
              <tr>
                <td>Total Trips Logged</td>
                <td class="col-right"><strong>${freight.trips_count} Dispatches</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="signature-box">
            <div class="signature-line"></div>
            <div><strong>Authorized Signatory</strong></div>
            <div style="font-size: 11px; color: #64748B;">Audit & Financial Division</div>
          </div>

          <div class="footer">
            <div>Generated automatically via Fleet Management System</div>
            <div>Timestamp: ${generatedAt}</div>
          </div>
        </body>
        </html>
      `;

      // Show options: Save/Print as PDF (via Print.printAsync, 100% reliable in Android Expo Go) or Share via Apps
      Alert.alert(
        "Export Financial Report",
        "Choose an export method:",
        [
          {
            text: "Save as PDF / Print",
            onPress: async () => {
              try {
                await Print.printAsync({ html: htmlContent });
              } catch (err) {
                console.error('Print error:', err);
                Alert.alert("Print Error", err.message || "Failed to launch PDF printer");
              }
            }
          },
          {
            text: "Share File",
            onPress: async () => {
              try {
                const { uri: tempUri } = await Print.printToFileAsync({ html: htmlContent });
                const fileName = `Financial_Report_${periodLabel.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
                const destUri = `${FileSystem.documentDirectory}${fileName}`;
                await FileSystem.copyAsync({ from: tempUri, to: destUri });
                await Sharing.shareAsync(destUri, {
                  mimeType: 'application/pdf',
                  dialogTitle: `${periodLabel} Financial Report`
                });
              } catch (shareErr) {
                console.log('Direct share rejected, falling back to system Print/PDF preview:', shareErr.message);
                // Graceful fallback to native Android Print preview (has "Save as PDF" built-in)
                await Print.printAsync({ html: htmlContent });
              }
            }
          },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } catch (e) {
      console.error('PDF generation error', e);
      Alert.alert('Export Notice', 'Could not open PDF. Trying direct print preview...');
      try {
        await Print.printAsync({ html: htmlContent });
      } catch (_) {}
    } finally {
      setIsExporting(false);
    }
  };

  const summary = reportData?.summary || { total_earnings: 0, total_expenses: 0, net_profit: 0, profit_margin_percent: 0 };
  const expenses = reportData?.expense_breakdown || { diesel: 0, maintenance: 0, salary: 0, advance: 0, emi: 0, other: 0 };
  const freight = reportData?.freight_metrics || { total_billed: 0, total_received: 0, total_pending: 0, trips_count: 0 };
  const monthlyTrend = reportData?.monthly_trend || [];

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Screen Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.screenTitle}>Financial Dashboard</Text>
          <Text style={styles.screenSubtitle}>
            {selectedSite ? selectedSite.name : 'All Sites'} • Net Profit & Audits
          </Text>
        </View>

        {/* Export PDF Button */}
        <TouchableOpacity 
          style={styles.exportPdfHeaderBtn} 
          onPress={exportPDFReport} 
          disabled={isExporting || isLoading}
          activeOpacity={0.8}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <>
              <MaterialCommunityIcons name="file-pdf-box" size={20} color="#DC2626" />
              <Text style={styles.exportPdfHeaderBtnText}>PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              fetchFinancialReport();
              loadAlerts();
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Automated Alerts Notification Banner (2 days prior to EMI / payment) */}
        {alertsData && alertsData.alerts && alertsData.alerts.length > 0 && (
          <View style={styles.alertsBannerContainer}>
            <TouchableOpacity 
              style={[styles.alertsBanner, alertsData.due_in_2_days_count > 0 ? styles.alertsBannerUrgent : styles.alertsBannerNormal]}
              onPress={() => setShowAlertsList(!showAlertsList)}
              activeOpacity={0.85}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <MaterialCommunityIcons 
                  name={alertsData.due_in_2_days_count > 0 ? "bell-alert" : "calendar-clock"} 
                  size={22} 
                  color={alertsData.due_in_2_days_count > 0 ? "#DC2626" : "#D97706"} 
                />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.alertsBannerTitle}>
                    {alertsData.due_in_2_days_count > 0 
                      ? `${alertsData.due_in_2_days_count} Payment / EMI Due in 2 Days!` 
                      : `${alertsData.total_alerts} Upcoming Compliance Reminders`}
                  </Text>
                  <Text style={styles.alertsBannerSub}>
                    {showAlertsList ? 'Tap to hide alerts' : 'Tap to review alerts list'}
                  </Text>
                </View>
              </View>
              <MaterialCommunityIcons 
                name={showAlertsList ? "chevron-up" : "chevron-down"} 
                size={22} 
                color="#64748B" 
              />
            </TouchableOpacity>

            {showAlertsList && (
              <View style={styles.alertsDropdown}>
                {alertsData.alerts.map((al) => (
                  <View key={al.id} style={styles.alertRow}>
                    <View style={[styles.alertDot, { backgroundColor: al.severity === 'CRITICAL' ? '#DC2626' : (al.is_due_in_2_days ? '#F59E0B' : '#3B82F6') }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertRowVehicle}>
                        {al.vehicle_number} • <Text style={{ fontWeight: '800', color: al.type === 'EMI' ? '#2563EB' : '#059669' }}>{al.type}</Text>
                      </Text>
                      <Text style={styles.alertRowMsg}>{al.message}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Period Switcher: Monthly vs Yearly */}
        <View style={styles.periodSwitcher}>
          <TouchableOpacity
            style={[styles.periodTab, period === 'monthly' && styles.periodTabActive]}
            onPress={() => setPeriod('monthly')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons 
              name="calendar-month" 
              size={16} 
              color={period === 'monthly' ? '#FFFFFF' : '#64748B'} 
              style={{ marginRight: 6 }} 
            />
            <Text style={[styles.periodTabText, period === 'monthly' && styles.periodTabTextActive]}>
              Monthly View
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.periodTab, period === 'yearly' && styles.periodTabActive]}
            onPress={() => setPeriod('yearly')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons 
              name="calendar-blank-multiple" 
              size={16} 
              color={period === 'yearly' ? '#FFFFFF' : '#64748B'} 
              style={{ marginRight: 6 }} 
            />
            <Text style={[styles.periodTabText, period === 'yearly' && styles.periodTabTextActive]}>
              Yearly View
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date Navigator */}
        <View style={styles.dateNavigator}>
          <TouchableOpacity style={styles.navArrow} onPress={handlePrev} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-left" size={24} color="#1E293B" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.dateNavTitle}>
              {period === 'monthly' ? `${MONTH_NAMES[month - 1]} ${year}` : `Year ${year}`}
            </Text>
            <Text style={styles.dateNavRange}>
              {reportData?.date_range ? `${reportData.date_range.start} to ${reportData.date_range.end}` : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.navArrow} onPress={handleNext} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#1E293B" />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={{ marginTop: 12, color: '#64748B', fontWeight: '600' }}>
              Calculating Financial Metrics...
            </Text>
          </View>
        ) : (
          <>
            {/* Hero Net Profit Card */}
            <View style={[styles.heroCard, summary.net_profit >= 0 ? styles.heroCardProfit : styles.heroCardLoss]}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroBadge}>
                  <MaterialCommunityIcons 
                    name={summary.net_profit >= 0 ? "trending-up" : "trending-down"} 
                    size={16} 
                    color={summary.net_profit >= 0 ? "#059669" : "#DC2626"} 
                  />
                  <Text style={[styles.heroBadgeText, { color: summary.net_profit >= 0 ? "#059669" : "#DC2626" }]}>
                    {summary.status} ({summary.profit_margin_percent}%)
                  </Text>
                </View>
                <Text style={styles.heroPeriodTag}>
                  {period === 'monthly' ? MONTH_NAMES[month - 1] : year}
                </Text>
              </View>

              <Text style={styles.heroLabel}>NET OPERATING PROFIT</Text>
              <Text style={[styles.heroProfitVal, { color: summary.net_profit >= 0 ? "#065F46" : "#991B1B" }]}>
                ₹{summary.net_profit.toLocaleString('en-IN')}
              </Text>
              <Text style={styles.heroFormula}>Earnings minus (Diesel + Maintenance + Salaries + EMI)</Text>

              {/* Sub Comparison Row */}
              <View style={styles.heroSubGrid}>
                <View style={styles.heroSubItem}>
                  <Text style={styles.heroSubLabel}>GROSS EARNINGS</Text>
                  <Text style={[styles.heroSubVal, { color: '#2563EB' }]}>
                    ₹{summary.total_earnings.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.heroSubDivider} />
                <View style={styles.heroSubItem}>
                  <Text style={styles.heroSubLabel}>TOTAL EXPENSES</Text>
                  <Text style={[styles.heroSubVal, { color: '#D97706' }]}>
                    ₹{summary.total_expenses.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Expense Breakdown Card */}
            <View style={styles.cardContainer}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
                  <MaterialCommunityIcons name="chart-pie" size={18} color="#DC2626" />
                </View>
                <Text style={styles.cardHeaderTitle}>Operational Expenses Breakdown</Text>
              </View>

              {/* 1. Diesel Expense */}
              <ExpenseItem
                icon="gas-station"
                iconColor="#D97706"
                bgColor="#FEF3C7"
                title="Diesel & Fuel"
                subtitle="Trip fuel and tank refills"
                amount={expenses.diesel}
                total={summary.total_expenses}
              />

              {/* 2. Maintenance Expense */}
              <ExpenseItem
                icon="wrench"
                iconColor="#2563EB"
                bgColor="#EFF6FF"
                title="Vehicle Repairs & Maintenance"
                subtitle="Spare parts, servicing & repairs"
                amount={expenses.maintenance}
                total={summary.total_expenses}
              />

              {/* 3. Salary & Wages */}
              <ExpenseItem
                icon="account-cash"
                iconColor="#059669"
                bgColor="#ECFDF5"
                title="Staff Salaries & Wages"
                subtitle="Disbursed driver & operator payroll"
                amount={expenses.salary}
                total={summary.total_expenses}
              />

              {/* 4. Staff Advances */}
              <ExpenseItem
                icon="hand-coin"
                iconColor="#7C3AED"
                bgColor="#F5F3FF"
                title="Staff Advances"
                subtitle="Driver travel advances & borrowings"
                amount={expenses.advance}
                total={summary.total_expenses}
              />

              {/* 5. Vehicle EMI */}
              <ExpenseItem
                icon="bank"
                iconColor="#0891B2"
                bgColor="#ECFEFF"
                title="Vehicle EMIs & Financing"
                subtitle="Bank loans and chassis installments"
                amount={expenses.emi}
                total={summary.total_expenses}
              />

              {/* 6. Other Expenses */}
              <ExpenseItem
                icon="dots-horizontal-circle-outline"
                iconColor="#64748B"
                bgColor="#F1F5F9"
                title="Other Operations & Overhead"
                subtitle="Toll, permits and misc expenses"
                amount={expenses.other}
                total={summary.total_expenses}
              />
            </View>

            {/* Freight Performance & Collection Metrics */}
            <View style={styles.cardContainer}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
                  <MaterialCommunityIcons name="truck-fast" size={18} color="#2563EB" />
                </View>
                <Text style={styles.cardHeaderTitle}>Freight & Logistics Accounting</Text>
              </View>

              <View style={styles.kpiRow}>
                <View style={styles.kpiBox}>
                  <Text style={styles.kpiBoxLabel}>BILTI BILLED</Text>
                  <Text style={styles.kpiBoxVal}>₹{freight.total_billed.toLocaleString('en-IN')}</Text>
                  <Text style={styles.kpiBoxSub}>{freight.trips_count} Total Trips</Text>
                </View>

                <View style={styles.kpiBox}>
                  <Text style={styles.kpiBoxLabel}>COLLECTED</Text>
                  <Text style={[styles.kpiBoxVal, { color: '#059669' }]}>
                    ₹{freight.total_received.toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.kpiBoxSub}>Advance & Freight</Text>
                </View>

                <View style={styles.kpiBox}>
                  <Text style={styles.kpiBoxLabel}>PENDING</Text>
                  <Text style={[styles.kpiBoxVal, { color: '#DC2626' }]}>
                    ₹{freight.total_pending.toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.kpiBoxSub}>Outstanding</Text>
                </View>
              </View>
            </View>

            {/* Yearly Trend Table (when Yearly View is active) */}
            {period === 'yearly' && monthlyTrend.length > 0 && (
              <View style={styles.cardContainer}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: '#F1F5F9' }]}>
                    <MaterialCommunityIcons name="table" size={18} color="#1E293B" />
                  </View>
                  <Text style={styles.cardHeaderTitle}>12-Month Net Profit Matrix</Text>
                </View>

                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCol, { flex: 1.2 }]}>Month</Text>
                  <Text style={[styles.tableCol, { flex: 1.5, textAlign: 'right' }]}>Earnings</Text>
                  <Text style={[styles.tableCol, { flex: 1.5, textAlign: 'right' }]}>Expenses</Text>
                  <Text style={[styles.tableCol, { flex: 1.5, textAlign: 'right' }]}>Net Profit</Text>
                </View>

                {monthlyTrend.map((item) => (
                  <View key={`m-${item.month}`} style={styles.tableRow}>
                    <Text style={[styles.tableRowText, { flex: 1.2, fontWeight: '700' }]}>
                      {item.month_name}
                    </Text>
                    <Text style={[styles.tableRowText, { flex: 1.5, textAlign: 'right', color: '#2563EB' }]}>
                      ₹{item.earnings.toLocaleString('en-IN')}
                    </Text>
                    <Text style={[styles.tableRowText, { flex: 1.5, textAlign: 'right', color: '#D97706' }]}>
                      ₹{item.expenses.toLocaleString('en-IN')}
                    </Text>
                    <Text style={[styles.tableRowText, { flex: 1.5, textAlign: 'right', fontWeight: '800', color: item.net_profit >= 0 ? '#059669' : '#DC2626' }]}>
                      ₹{item.net_profit.toLocaleString('en-IN')}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Bottom PDF Export Button */}
            <TouchableOpacity 
              style={styles.fullExportBtn} 
              onPress={exportPDFReport}
              disabled={isExporting}
              activeOpacity={0.85}
            >
              {isExporting ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <MaterialCommunityIcons name="file-pdf-box" size={22} color="white" />
                  <Text style={styles.fullExportBtnText}>Generate & Share PDF Report</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Single Expense Row with progress percentage bar
function ExpenseItem({ icon, iconColor, bgColor, title, subtitle, amount, total }) {
  const percent = total > 0 ? ((amount / total) * 100).toFixed(1) : '0';

  return (
    <View style={styles.expenseItem}>
      <View style={styles.expenseItemTop}>
        <View style={[styles.expenseIcon, { backgroundColor: bgColor }]}>
          <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
        </View>
        <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
          <Text style={styles.expenseTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.expenseSub} numberOfLines={1}>{subtitle}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
          <Text style={styles.expenseAmount}>₹{amount.toLocaleString('en-IN')}</Text>
          <View style={[styles.percentBadge, { backgroundColor: `${iconColor}18` }]}>
            <Text style={[styles.percentBadgeText, { color: iconColor }]}>{percent}% Share</Text>
          </View>
        </View>
      </View>

      {/* Visual progress bar */}
      <View style={styles.progressBarBg}>
        <View 
          style={[
            styles.progressBarFill, 
            { width: `${Math.min(100, Math.max(0, parseFloat(percent)))}%`, backgroundColor: iconColor }
          ]} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC'
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A'
  },
  screenSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  exportPdfHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  exportPdfHeaderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
    marginLeft: 4
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  alertsBannerContainer: {
    marginBottom: 16
  },
  alertsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1
  },
  alertsBannerUrgent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA'
  },
  alertsBannerNormal: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A'
  },
  alertsBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A'
  },
  alertsBannerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  alertsDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    marginRight: 8
  },
  alertRowVehicle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B'
  },
  alertRowMsg: {
    fontSize: 11,
    color: '#475569',
    marginTop: 1
  },
  periodSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14
  },
  periodTab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 8
  },
  periodTabActive: {
    backgroundColor: '#2563EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B'
  },
  periodTabTextActive: {
    color: '#FFFFFF'
  },
  dateNavigator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  navArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  dateNavTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A'
  },
  dateNavRange: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  heroCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1
  },
  heroCardProfit: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  heroCardLoss: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA'
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4
  },
  heroPeriodTag: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B'
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5
  },
  heroProfitVal: {
    fontSize: 28,
    fontWeight: '900',
    marginVertical: 4
  },
  heroFormula: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 14
  },
  heroSubGrid: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  heroSubItem: {
    flex: 1,
    alignItems: 'center'
  },
  heroSubDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#E2E8F0'
  },
  heroSubLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B'
  },
  heroSubVal: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A'
  },
  expenseItem: {
    marginBottom: 14
  },
  expenseItemTop: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  expenseIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  expenseTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B'
  },
  expenseSub: {
    fontSize: 11,
    color: '#64748B'
  },
  expenseAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A'
  },
  percentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  percentBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 5,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    marginTop: 6,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8
  },
  kpiBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center'
  },
  kpiBoxLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B'
  },
  kpiBoxVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginVertical: 3
  },
  kpiBoxSub: {
    fontSize: 10,
    color: '#64748B'
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 6
  },
  tableCol: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569'
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  tableRowText: {
    fontSize: 12,
    color: '#1E293B'
  },
  fullExportBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 6,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4
  },
  fullExportBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 8
  }
});
