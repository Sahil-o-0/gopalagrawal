import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Image, Modal, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../context/AuthContext';
import { saveTripOffline } from '../context/OfflineStorage';
import { useBackgroundSync } from '../context/useBackgroundSync';
import { API_BASE_URL } from '../config';

export default function TripLogForm({ isAdmin = false, staffList = [], onSuccess = null }) {
    const { userToken } = useContext(AuthContext);
    const { isOnline, pendingCount, syncPendingData } = useBackgroundSync();
    const [isLoading, setIsLoading] = useState(false);
    
    // Form state
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [materialType, setMaterialType] = useState('');
    const [weightTons, setWeightTons] = useState('');
    const [startMeter, setStartMeter] = useState('');
    const [endMeter, setEndMeter] = useState('');
    const [dieselLiters, setDieselLiters] = useState('');
    const [dieselCost, setDieselCost] = useState('');
    
    // Photo state
    const [loadingPhoto, setLoadingPhoto] = useState(null);
    const [unloadingPhoto, setUnloadingPhoto] = useState(null);
    const [odometerPhoto, setOdometerPhoto] = useState(null);
    const [receiptPhoto, setReceiptPhoto] = useState(null);

    // Admin-specific state
    const [staffId, setStaffId] = useState('');
    const [isStaffPickerVisible, setIsStaffPickerVisible] = useState(false);

    const takePhoto = async (setter) => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera permission is required');
            return;
        }

        let result = await ImagePicker.launchCameraAsync({
            mediaTypes: 'images',
            allowsEditing: false,
            quality: 0.3,
            base64: true,
        });

        if (!result.canceled) {
            setter(`data:image/jpeg;base64,${result.assets[0].base64}`);
        }
    };

    const handleSubmit = async () => {
        if (!vehicleNumber || !origin || !destination || !materialType || !weightTons || !startMeter || !endMeter) {
            Alert.alert("Missing Fields", "Please fill in all mandatory fields.");
            return;
        }

        setIsLoading(true);
        try {
            const body = {
                vehicle_number: vehicleNumber,
                origin: origin,
                destination: destination,
                material_type: materialType,
                weight_tons: parseFloat(weightTons),
                start_meter_reading: parseFloat(startMeter),
                end_meter_reading: parseFloat(endMeter),
                diesel_liters: dieselLiters ? parseFloat(dieselLiters) : 0,
                diesel_cost: dieselCost ? parseFloat(dieselCost) : 0,
                loading_photo_url: loadingPhoto,
                unloading_photo_url: unloadingPhoto,
                odometer_photo_url: odometerPhoto,
                receipt_photo_url: receiptPhoto
            };

            if (isAdmin && staffId) {
                body.staff_id = parseInt(staffId);
            }

            if (isOnline) {
                // Try direct upload
                const response = await fetch(`${API_BASE_URL}/trips/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${userToken}`
                    },
                    body: JSON.stringify(body)
                });

                if (response.ok) {
                    Alert.alert("Success", isAdmin ? "Trip logged and automatically approved!" : "Trip log submitted successfully!");
                    clearForm();
                    if (onSuccess) onSuccess();
                } else {
                    const data = await response.json();
                    Alert.alert("Error", data.detail || "Failed to submit trip log");
                }
            } else {
                // Offline Mode: Save to queue
                await saveTripOffline(body, {});
                Alert.alert("Saved Offline", "Trip saved locally. It will automatically upload when internet is restored.");
                clearForm();
            }
        } catch (error) {
            console.log(error);
            // Fallback: If fetch failed despite NetInfo thinking we are online
            await saveTripOffline(body, {});
            Alert.alert("Network Issue", "Could not reach server. Trip saved offline.");
            clearForm();
        }
        setIsLoading(false);
    };

    const clearForm = () => {
        setVehicleNumber(''); setOrigin(''); setDestination(''); setMaterialType(''); setWeightTons('');
        setStartMeter(''); setEndMeter(''); setDieselLiters(''); setDieselCost('');
        setLoadingPhoto(null); setUnloadingPhoto(null); setOdometerPhoto(null); setReceiptPhoto(null);
        setStaffId('');
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
            {/* Network Banner */}
            {!isOnline && (
                <View style={styles.offlineBanner}>
                    <MaterialCommunityIcons name="wifi-off" size={16} color="white" style={{marginRight: 8}} />
                    <Text style={styles.offlineText}>Offline Mode - Logs stored locally</Text>
                </View>
            )}
            
            {pendingCount > 0 && isOnline && (
                <TouchableOpacity style={styles.syncBanner} onPress={syncPendingData}>
                    <MaterialCommunityIcons name="sync" size={16} color="white" style={{marginRight: 8}} />
                    <Text style={styles.syncText}>{pendingCount} Pending Uploads. Tap to Sync.</Text>
                </TouchableOpacity>
            )}

            {/* Editorial Header */}
            <View style={styles.editorialHeader}>
                <Text style={styles.editorialTitle}>Log New Trip</Text>
                <Text style={styles.editorialSubtitle}>Digital Fleet Command • TR-{(Math.random()*100000).toFixed(0)}</Text>
            </View>

            {/* Segment 1: Vehicle Identification */}
            <View style={styles.cardVehicle}>
                <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name="truck-delivery" size={24} color="#60A5FA" />
                    <Text style={styles.cardTitleLight}>Vehicle Identification</Text>
                </View>

                {isAdmin && (
                    <View style={styles.adminPickerGroup}>
                        <Text style={styles.labelLight}>Assign Staff</Text>
                        <TouchableOpacity style={styles.pickerTrigger} onPress={() => setIsStaffPickerVisible(true)}>
                            <Text style={styles.pickerTriggerText}>
                                {staffList.find(u => u.id.toString() === staffId)?.username || "Select Staff member"}
                            </Text>
                            <MaterialCommunityIcons name="chevron-down" size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.inputWrapper}>
                    <Text style={styles.labelLight}>Vehicle Plate</Text>
                    <TextInput 
                        placeholderTextColor="#94A3B8" 
                        style={styles.inputLight} 
                        placeholder="MH-12-FE-4920" 
                        value={vehicleNumber} 
                        onChangeText={setVehicleNumber} 
                    />
                </View>
            </View>

            {/* Segment 2: Odometer (High Contrast) */}
            <View style={styles.bentoRow}>
                <View style={[styles.cardBento, {borderLeftColor: '#091426', borderLeftWidth: 4, flex: 1.5}]}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Odometer Readings</Text>
                        <MaterialCommunityIcons name="speedometer" size={20} color="#091426" />
                    </View>
                    <View style={styles.odoInputGroup}>
                        <TextInput 
                            placeholderTextColor="#CBD5E1" 
                            style={styles.odoInput} 
                            placeholder="START" 
                            keyboardType="numeric" 
                            value={startMeter} 
                            onChangeText={setStartMeter} 
                        />
                        <View style={styles.odoDivider} />
                        <TextInput 
                            placeholderTextColor="#CBD5E1" 
                            style={styles.odoInput} 
                            placeholder="END" 
                            keyboardType="numeric" 
                            value={endMeter} 
                            onChangeText={setEndMeter} 
                        />
                    </View>
                </View>

                <View style={[styles.cardBento, {backgroundColor: '#1E293B', flex: 1}]}>
                    <Text style={styles.labelLightSmall}>Total KM</Text>
                    <Text style={styles.odoResultText}>
                        { (parseFloat(endMeter) - parseFloat(startMeter)) || 0 }
                    </Text>
                    <Text style={styles.labelLightSmall}>Estimated Distance</Text>
                </View>
            </View>

            {/* Segment 3: Route & Material */}
            <View style={styles.cardSurface}>
                 <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Route & Cargo</Text>
                    <MaterialCommunityIcons name="map-marker-path" size={20} color="#006c49" />
                </View>

                 <View style={styles.routeFlow}>
                    <View style={styles.routePin}><View style={styles.pinDot} /><View style={styles.pinLine} /></View>
                    <TextInput placeholderTextColor="#94A3B8" style={styles.inputPlain} placeholder="Origin Point" value={origin} onChangeText={setOrigin} />
                 </View>
                 <View style={styles.routeFlow}>
                    <View style={styles.routePin}><View style={[styles.pinDot, {backgroundColor: '#EF4444'}]} /></View>
                    <TextInput placeholderTextColor="#94A3B8" style={styles.inputPlain} placeholder="Destination Point" value={destination} onChangeText={setDestination} />
                 </View>

                 <View style={styles.cargoGrid}>
                    <TextInput placeholderTextColor="#94A3B8" style={[styles.inputPlain, {flex: 2}]} placeholder="Material (e.g. Coal)" value={materialType} onChangeText={setMaterialType} />
                    <TextInput placeholderTextColor="#94A3B8" style={[styles.inputPlain, {flex: 1}]} placeholder="Weight (t)" keyboardType="numeric" value={weightTons} onChangeText={setWeightTons} />
                 </View>
            </View>

            {/* Segment 4: Fuel (Optional) */}
            <View style={[styles.cardSurface, {borderLeftColor: '#006c49', borderLeftWidth: 4}]}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Fuel Tracking</Text>
                    <MaterialCommunityIcons name="gas-station" size={20} color="#006c49" />
                </View>
                <View style={styles.cargoGrid}>
                    <TextInput placeholderTextColor="#94A3B8" style={[styles.inputPlain, {flex: 1}]} placeholder="Liters Taken" keyboardType="numeric" value={dieselLiters} onChangeText={setDieselLiters} />
                    <TextInput placeholderTextColor="#94A3B8" style={[styles.inputPlain, {flex: 1}]} placeholder="Total Cost (₹)" keyboardType="numeric" value={dieselCost} onChangeText={setDieselCost} />
                </View>
            </View>

            {/* Segment 5: Photo Evidence */}
            <View style={styles.cardSurface}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Photo Evidence</Text>
                    <MaterialCommunityIcons name="camera-enhance" size={20} color="#64748B" />
                </View>
                
                <View style={styles.photoGallery}>
                    <TouchableOpacity style={styles.photoTile} onPress={() => takePhoto(setLoadingPhoto)}>
                        {loadingPhoto ? <Image source={{uri: loadingPhoto}} style={styles.photoPreview} resizeMode="cover" /> : <MaterialCommunityIcons name="truck-plus" size={32} color="#CBD5E1" />}
                        <Text style={styles.photoLabelSmall}>Loading</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.photoTile} onPress={() => takePhoto(setUnloadingPhoto)}>
                        {unloadingPhoto ? <Image source={{uri: unloadingPhoto}} style={styles.photoPreview} resizeMode="cover" /> : <MaterialCommunityIcons name="truck-check" size={32} color="#CBD5E1" />}
                        <Text style={styles.photoLabelSmall}>Unloading</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.photoTile} onPress={() => takePhoto(setOdometerPhoto)}>
                        {odometerPhoto ? <Image source={{uri: odometerPhoto}} style={styles.photoPreview} resizeMode="cover" /> : <MaterialCommunityIcons name="counter" size={32} color="#CBD5E1" />}
                        <Text style={styles.photoLabelSmall}>Odometer</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.photoTile, {borderStyle: receiptPhoto ? 'solid' : 'dashed', backgroundColor: '#F8FAFC'}]} onPress={() => takePhoto(setReceiptPhoto)}>
                        {receiptPhoto ? <Image source={{uri: receiptPhoto}} style={styles.photoPreview} resizeMode="cover" /> : (
                            <>
                                <MaterialCommunityIcons name="plus" size={24} color="#CBD5E1" />
                                <Text style={styles.photoLabelSmall}>More</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Actions */}
            <View style={styles.actionArea}>
                <TouchableOpacity style={styles.discardBtn} onPress={clearForm}>
                    <Text style={styles.discardText}>Clear Data</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isLoading}>
                    {isLoading ? <ActivityIndicator color="white" /> : (
                        <>
                            <MaterialCommunityIcons name="send-check" size={24} color="white" />
                            <Text style={styles.submitText}>Dispatch Trip</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Staff Picker Modal (Keep logic but style consistent) */}
            <Modal visible={isStaffPickerVisible} transparent animationType="fade">
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setIsStaffPickerVisible(false)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Assign to Staff</Text>
                        <ScrollView>
                            {staffList.filter(u => u.role !== 'ADMIN').map(u => (
                                <TouchableOpacity 
                                    key={u.id} 
                                    style={styles.staffOption} 
                                    onPress={() => { setStaffId(u.id.toString()); setIsStaffPickerVisible(false); }}
                                >
                                    <Text style={styles.staffOptionName}>{u.full_name || u.username}</Text>
                                    <Text style={styles.staffOptionUsername}>@{u.username}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setIsStaffPickerVisible(false)}>
                            <Text style={styles.closeBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F7F9FB' },
    contentContainer: { padding: 20, paddingBottom: 50 },
    offlineBanner: { backgroundColor: '#F59E0B', padding: 12, borderRadius: 12, marginBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    offlineText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
    syncBanner: { backgroundColor: '#3B82F6', padding: 12, borderRadius: 12, marginBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    syncText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
    
    editorialHeader: { marginBottom: 25 },
    editorialTitle: { fontSize: 32, fontWeight: '800', color: '#091426', letterSpacing: -0.5 },
    editorialSubtitle: { fontSize: 14, color: '#64748B', fontWeight: '600', marginTop: 4 },

    cardVehicle: { backgroundColor: '#091426', borderRadius: 16, padding: 20, marginBottom: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    cardTitleLight: { fontSize: 17, fontWeight: 'bold', color: 'white' },
    cardTitle: { fontSize: 17, fontWeight: 'bold', color: '#091426' },
    
    labelLight: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
    inputLight: { backgroundColor: '#1E293B', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 18, fontWeight: 'bold', color: 'white' },
    inputWrapper: { marginTop: 15 },

    bentoRow: { flexDirection: 'row', gap: 15, marginBottom: 20 },
    cardBento: { backgroundColor: 'white', borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, justifyContent: 'center' },
    odoInputGroup: { marginTop: 10 },
    odoInput: { fontSize: 28, fontWeight: '900', color: '#091426', paddingVertical: 4 },
    odoDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 8 },
    labelLightSmall: { fontSize: 10, fontWeight: 'bold', color: '#94A3B8', textTransform: 'uppercase', textAlign: 'center' },
    odoResultText: { fontSize: 32, fontWeight: '900', color: '#60A5FA', textAlign: 'center', marginVertical: 5 },

    cardSurface: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 20, elevation: 2 },
    routeFlow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    routePin: { width: 20, alignItems: 'center', marginRight: 15 },
    pinDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#006c49' },
    pinLine: { width: 2, flex: 1, height: 20, backgroundColor: '#E2E8F0', marginVertical: 4 },
    inputPlain: { fontSize: 16, fontWeight: '600', color: '#0F172A', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 8, flex: 1 },
    
    cargoGrid: { flexDirection: 'row', gap: 15, marginTop: 10 },
    
    photoGallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
    photoTile: { width: '22.5%', aspectRatio: 1, backgroundColor: '#F1F5F9', borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
    photoPreview: { width: '100%', height: '100%' },
    photoLabelSmall: { fontSize: 9, fontWeight: 'bold', color: '#94A3B8', marginTop: 4, textAlign: 'center' },

    actionArea: { flexDirection: 'row', gap: 15, marginTop: 10, alignItems: 'center' },
    discardBtn: { padding: 15, flex: 1 },
    discardText: { color: '#64748B', fontWeight: 'bold', textAlign: 'center' },
    submitBtn: { backgroundColor: '#006c49', flex: 3, height: 60, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, elevation: 8, shadowColor: '#006c49', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
    submitText: { color: 'white', fontSize: 18, fontWeight: '700' },

    adminPickerGroup: { marginBottom: 15 },
    pickerTrigger: { backgroundColor: '#1E293B', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pickerTriggerText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '85%', backgroundColor: 'white', borderRadius: 20, padding: 25, elevation: 10 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#091426', marginBottom: 20 },
    staffOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    staffOptionName: { fontSize: 17, fontWeight: 'bold', color: '#0F172A' },
    staffOptionUsername: { fontSize: 13, color: '#64748B' },
    closeBtn: { marginTop: 20, backgroundColor: '#091426', borderRadius: 12, paddingVertical: 14 },
    closeBtnText: { color: 'white', fontWeight: 'bold', textAlign: 'center' }
});

