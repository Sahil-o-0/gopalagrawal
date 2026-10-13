import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';


const SYNC_QUEUE_KEY = '@fleet_sync_queue';

export const saveRequestOffline = async (endpoint, method = 'POST', payload = {}) => {
    try {
        const queuedItem = {
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            endpoint,
            method,
            payload,
            timestamp: new Date().toISOString()
        };

        const existingQueueStr = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
        const queue = existingQueueStr ? JSON.parse(existingQueueStr) : [];
        queue.push(queuedItem);
        await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
        return queuedItem;
    } catch (e) {
        console.error("Failed to save request offline:", e);
        throw e;
    }
};

export const saveTripOffline = async (tripData, photos = {}) => {
    try {
        const savedPhotos = {};
        if (photos && typeof photos === 'object') {
            for (const [key, uri] of Object.entries(photos)) {
                if (uri && typeof uri === 'string' && !uri.startsWith('data:')) {
                    try {
                        const filename = uri.split('/').pop() || `photo_${Date.now()}.jpg`;
                        const newPath = (FileSystem.documentDirectory || '') + filename;
                        await FileSystem.copyAsync({ from: uri, to: newPath });
                        savedPhotos[key] = newPath;
                    } catch (photoErr) {
                        console.warn("Could not copy photo locally, preserving original uri:", photoErr);
                        savedPhotos[key] = uri;
                    }
                } else if (uri) {
                    savedPhotos[key] = uri;
                }
            }
        }

        const queuedItem = {
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            endpoint: '/trips/',
            method: 'POST',
            payload: tripData,
            photos: savedPhotos,
            timestamp: new Date().toISOString()
        };

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
