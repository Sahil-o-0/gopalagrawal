import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';


const SYNC_QUEUE_KEY = '@fleet_sync_queue';

export const saveTripOffline = async (tripData, photos) => {
    try {
        // 1. Move photos to persistent document directory so they aren't cleared from cache
        const savedPhotos = {};
        for (const [key, uri] of Object.entries(photos)) {
            if (uri) {
                const filename = uri.split('/').pop();
                const newPath = FileSystem.documentDirectory + filename;
                await FileSystem.copyAsync({ from: uri, to: newPath });
                savedPhotos[key] = newPath;
            }
        }

        // 2. Wrap the data
        const queuedItem = {
            id: Date.now().toString(),
            endpoint: '/trips/',
            method: 'POST',
            payload: tripData,
            photos: savedPhotos, // To be uploaded as multipart form later
            timestamp: new Date().toISOString()
        };

        // 3. Save to Queue
        const existingQueueStr = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
        const queue = existingQueueStr ? JSON.parse(existingQueueStr) : [];
        queue.push(queuedItem);
        await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));

        return queuedItem;
    } catch (e) {
        console.error("Failed to save trip offline:", e);
        throw e;
    }
};

export const getSyncQueue = async () => {
    try {
        const queueStr = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
        return queueStr ? JSON.parse(queueStr) : [];
    } catch (e) {
        return [];
    }
};

export const removeFromSyncQueue = async (itemId) => {
    try {
        const queueStr = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
        if (!queueStr) return;
        
        let queue = JSON.parse(queueStr);
        queue = queue.filter(item => item.id !== itemId);
        await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
        console.error("Failed to remove from queue", e);
    }
};

export const clearSyncQueue = async () => {
    await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
};
