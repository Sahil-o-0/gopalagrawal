import { useEffect, useContext, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AuthContext } from './AuthContext';
import { getSyncQueue, removeFromSyncQueue } from './OfflineStorage';
import { API_BASE_URL } from '../config';

export const useBackgroundSync = () => {
    const { userToken } = useContext(AuthContext);
    const [isOnline, setIsOnline] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    // Listen to network changes
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOnline(state.isConnected && state.isInternetReachable !== false);
        });

        // Initial check for pending items
        refreshPendingCount();

        return () => unsubscribe();
    }, []);

    // Trigger sync when coming back online
    useEffect(() => {
        if (isOnline && userToken && !isSyncing) {
            syncPendingData();
        }
    }, [isOnline, userToken]);

    const refreshPendingCount = async () => {
        const queue = await getSyncQueue();
        setPendingCount(queue.length);
    };

    const syncPendingData = async () => {
        const queue = await getSyncQueue();
        if (queue.length === 0) return;
        
        setIsSyncing(true);
        console.log(`Starting sync for ${queue.length} items...`);

        for (const item of queue) {
            try {
                // In a real app we would use FormData here to upload the photos from item.photos
                // For this MVP, we will just sync the text payload
                
                const response = await fetch(`${API_BASE_URL}${item.endpoint}`, {
                    method: item.method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${userToken}`
                    },
                    body: JSON.stringify(item.payload)
                });

                if (response.ok) {
                    await removeFromSyncQueue(item.id);
                    console.log(`Successfully synced item: ${item.id}`);
                } else if (response.status === 400 || response.status === 401) {
                    // Bad request or unauthorized, might need manual intervention, but remove to prevent infinite loop for now
                    console.warn(`Sync failed permanently for item ${item.id}: ${response.status}`);
                    await removeFromSyncQueue(item.id);
                }
            } catch (error) {
                console.log(`Network error syncing item ${item.id}, will retry later.`);
                // Stop the loop if network is actually down
                break; 
            }
        }

        setIsSyncing(false);
        refreshPendingCount();
    };

    return { isOnline, isSyncing, pendingCount, syncPendingData, refreshPendingCount };
};
