import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from './AuthContext';
import { API_BASE_URL } from '../config';

/**
 * Safely parse a fetch Response as JSON.
 * If the server returns HTML (e.g. nginx 404/502) this returns null
 * instead of crashing with "Unexpected character: <".
 */
async function safeJson(response) {
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return null;
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
}

const STORAGE_KEY = '@selected_site_id';

export const SiteContext = createContext(null);

export const SiteProvider = ({ children }) => {
  const authContext = useContext(AuthContext);
  const userToken = authContext?.userToken || null;

  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteIdState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper function to update state and AsyncStorage
  const setSelectedSiteId = useCallback(async (id) => {
    try {
      setSelectedSiteIdState(id);
      if (id !== null && id !== undefined) {
        await AsyncStorage.setItem(STORAGE_KEY, String(id));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to save selected site to AsyncStorage:', e);
    }
  }, []);

  const fetchSites = useCallback(async () => {
    // Don't attempt to fetch if there's no auth token yet
    if (!userToken) {
      setSites([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      };

      const response = await fetch(`${API_BASE_URL}/sites/`, { headers });
      if (response.ok) {
        const data = await safeJson(response);
        const siteList = Array.isArray(data) ? data : [];
        setSites(siteList);

        // Restore selected site from AsyncStorage or pick default first site
        let storedSiteId = null;
        try {
          storedSiteId = await AsyncStorage.getItem(STORAGE_KEY);
        } catch (e) {
          console.warn('Failed to read selected site from AsyncStorage:', e);
        }

        if (storedSiteId !== null && storedSiteId !== undefined && siteList.some(s => String(s.id) === String(storedSiteId))) {
          const matchedSite = siteList.find(s => String(s.id) === String(storedSiteId));
          setSelectedSiteIdState(matchedSite ? matchedSite.id : storedSiteId);
        } else if (siteList.length > 0) {
          const defaultId = siteList[0].id;
          setSelectedSiteIdState(defaultId);
          try {
            await AsyncStorage.setItem(STORAGE_KEY, String(defaultId));
          } catch (e) {
            console.warn('Failed to set default site in AsyncStorage:', e);
          }
        } else {
          setSelectedSiteIdState(null);
        }
      } else {
        const errData = await safeJson(response);
        const errMsg = errData?.detail
          || `Server returned ${response.status}. Check that the backend is running and reachable.`;
        setError(errMsg);
      }
    } catch (e) {
      console.warn('Network error fetching sites:', e);
      setError('Network error: Unable to connect to the backend server at ' + API_BASE_URL);
    } finally {
      setLoading(false);
    }
  }, [userToken]);

  // Fetch when token is available; clear state when logged out
  useEffect(() => {
    if (userToken) {
      fetchSites();
    } else {
      setSites([]);
      setSelectedSiteIdState(null);
      setError(null);
    }
  }, [userToken]);

  // Derived selectedSite property
  const selectedSite = useMemo(() => {
    if (!sites || sites.length === 0) return null;
    if (selectedSiteId !== null && selectedSiteId !== undefined) {
      const found = sites.find(s => String(s.id) === String(selectedSiteId));
      if (found) return found;
    }
    return sites[0] || null;
  }, [sites, selectedSiteId]);

  const value = useMemo(() => ({
    sites,
    selectedSiteId,
    setSelectedSiteId,
    selectedSite,
    fetchSites,
    loading,
    error,
  }), [sites, selectedSiteId, setSelectedSiteId, selectedSite, fetchSites, loading, error]);

  return (
    <SiteContext.Provider value={value}>
      {children}
    </SiteContext.Provider>
  );
};

export const useSite = () => {
  const context = useContext(SiteContext);
  if (!context) {
    throw new Error('useSite must be used within a SiteProvider');
  }
  return context;
};
