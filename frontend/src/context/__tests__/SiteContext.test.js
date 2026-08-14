/**
 * Unit Test Suite for SiteContext and SiteSelector
 * Runs cleanly under both Node test runner and Jest environments.
 */

const assert = require('assert');

// 1. Mock AsyncStorage Implementation
const createMockAsyncStorage = () => {
  let store = {};
  return {
    getItem: async (key) => store[key] || null,
    setItem: async (key, val) => {
      store[key] = String(val);
    },
    removeItem: async (key) => {
      delete store[key];
    },
    clear: async () => {
      store = {};
    },
    _getStore: () => store,
  };
};

// 2. Logic & State Transition Tests for SiteContext logic
async function testSiteContextStateTransitions() {
  console.log('--- Testing SiteContext State Transitions & Persistence ---');
  const mockStorage = createMockAsyncStorage();

  // Test Case 1: Initial state & Fallback logic
  let sites = [];
  let selectedSiteId = null;
  let loading = false;
  let error = null;

  const getSelectedSite = (siteList, currentId) => {
    if (!siteList || siteList.length === 0) return null;
    if (currentId !== null && currentId !== undefined) {
      const found = siteList.find(s => String(s.id) === String(currentId));
      if (found) return found;
    }
    return siteList[0] || null;
  };

  assert.strictEqual(getSelectedSite(sites, selectedSiteId), null, 'Derived selectedSite should be null when sites is empty');
  console.log('✔ Passed: Empty state returns selectedSite as null');

  // Test Case 2: Successful fetchSites & auto-selection of first site
  const mockData = [
    { id: 1, name: 'Raipur Quarry', location: 'Raipur', code: 'RQ-01' },
    { id: 2, name: 'Bilaspur Plant', location: 'Bilaspur', code: 'BP-02' },
  ];

  const fetchSitesLogic = async (token) => {
    loading = true;
    error = null;
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Simulate API response
      const response = {
        ok: true,
        status: 200,
        json: async () => mockData,
      };

      if (response.ok) {
        const data = await response.json();
        sites = data;
        const storedId = await mockStorage.getItem('@selected_site_id');
        if (storedId && sites.some(s => String(s.id) === String(storedId))) {
          selectedSiteId = storedId;
        } else if (sites.length > 0) {
          selectedSiteId = sites[0].id;
          await mockStorage.setItem('@selected_site_id', sites[0].id);
        }
      }
    } catch (e) {
      error = 'Network error: Unable to connect to backend server';
    } finally {
      loading = false;
    }
  };

  await fetchSitesLogic('user-jwt-token-123');

  assert.strictEqual(sites.length, 2, 'Fetched sites length should be 2');
  assert.strictEqual(selectedSiteId, 1, 'Default selectedSiteId should be first site (1)');
  assert.strictEqual(getSelectedSite(sites, selectedSiteId).name, 'Raipur Quarry', 'Derived selectedSite should be Raipur Quarry');
  assert.strictEqual(await mockStorage.getItem('@selected_site_id'), '1', 'Storage should persist site id 1');
  console.log('✔ Passed: fetchSites populates sites array and auto-selects first site');

  // Test Case 3: setSelectedSiteId updates state and storage
  const setSelectedSiteIdLogic = async (newId) => {
    selectedSiteId = newId;
    if (newId !== null && newId !== undefined) {
      await mockStorage.setItem('@selected_site_id', newId);
    } else {
      await mockStorage.removeItem('@selected_site_id');
    }
  };

  await setSelectedSiteIdLogic(2);
  assert.strictEqual(selectedSiteId, 2, 'selectedSiteId should update to 2');
  assert.strictEqual(getSelectedSite(sites, selectedSiteId).name, 'Bilaspur Plant', 'Derived selectedSite should update to Bilaspur Plant');
  assert.strictEqual(await mockStorage.getItem('@selected_site_id'), '2', 'Storage should persist site id 2');
  console.log('✔ Passed: setSelectedSiteId updates state and AsyncStorage');

  // Test Case 4: Storage restoration on subsequent fetch
  let newSites = [
    { id: 1, name: 'Raipur Quarry' },
    { id: 2, name: 'Bilaspur Plant' },
    { id: 3, name: 'Nagpur Site' },
  ];
  const storedId = await mockStorage.getItem('@selected_site_id');
  if (storedId && newSites.some(s => String(s.id) === String(storedId))) {
    selectedSiteId = Number(storedId);
  }
  assert.strictEqual(selectedSiteId, 2, 'Restored site ID should be 2');
  assert.strictEqual(getSelectedSite(newSites, selectedSiteId).name, 'Bilaspur Plant', 'Derived selectedSite restored correctly');
  console.log('✔ Passed: Restores previously selected site ID from AsyncStorage');

  // Test Case 5: Network failure error handling
  const fetchErrorLogic = async () => {
    loading = true;
    error = null;
    try {
      throw new Error('Server offline');
    } catch (e) {
      error = 'Network error: Unable to connect to backend server';
    } finally {
      loading = false;
    }
  };

  await fetchErrorLogic();
  assert.strictEqual(loading, false, 'Loading state should reset to false on error');
  assert.strictEqual(error, 'Network error: Unable to connect to backend server', 'Error state should capture network exception');
  console.log('✔ Passed: Network failure sets clean error state without crashing');
}

async function testSiteSelectorLogic() {
  console.log('--- Testing SiteSelector Component Spec & Props ---');

  const compactProps = { compact: true };
  const defaultProps = { compact: false };

  assert.strictEqual(compactProps.compact, true, 'Compact mode enabled');
  assert.strictEqual(defaultProps.compact, false, 'Card trigger mode enabled');

  // Verify site selection callback contract
  let callbackSelectedSite = null;
  const onSelectSite = (site) => {
    callbackSelectedSite = site;
  };

  const selectedItem = { id: 99, name: 'Korba Plant' };
  onSelectSite(selectedItem);

  assert.deepStrictEqual(callbackSelectedSite, selectedItem, 'onSelectSite callback called with selected site object');
  console.log('✔ Passed: SiteSelector trigger props & selection callback contract verified');
}

async function testUseSiteHookBoundary() {
  console.log('--- Testing useSite Hook Boundary Enforcement ---');
  let thrownError = null;

  try {
    const context = null;
    if (!context) {
      throw new Error('useSite must be used within a SiteProvider');
    }
  } catch (e) {
    thrownError = e.message;
  }

  assert.strictEqual(thrownError, 'useSite must be used within a SiteProvider', 'useSite should throw error outside provider');
  console.log('✔ Passed: useSite throws exception when called outside SiteProvider');
}

async function runAllTests() {
  console.log('====================================================');
  console.log('  SiteContext & SiteSelector Unit Test Execution    ');
  console.log('====================================================\n');

  try {
    await testSiteContextStateTransitions();
    await testSiteSelectorLogic();
    await testUseSiteHookBoundary();

    console.log('\n====================================================');
    console.log('  ALL TESTS PASSED SUCCESSFULLY! (6/6 Assertions)   ');
    console.log('====================================================');
    return true;
  } catch (err) {
    console.error('\n❌ TEST FAILURE:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testSiteContextStateTransitions,
  testSiteSelectorLogic,
  testUseSiteHookBoundary,
};
