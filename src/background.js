// Background script to track tab creation
chrome.tabs.onCreated.addListener((tab) => {
  recordTabOpen(tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Record when a tab's URL changes (navigation)
  if (changeInfo.url) {
    recordTabOpen(tab);
  }
});

async function recordTabOpen(tab) {
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    return; // Skip internal Chrome pages
  }

  const now = new Date();
  
  const tabRecord = {
    url: tab.url,
    title: tab.title || 'Loading...',
    timestamp: now.toISOString(),
    domain: extractDomain(tab.url)
  };

  try {
    // Get existing data
    const result = await chrome.storage.local.get('weekData');
    
    // Initialize or parse existing data
    let weekData = [];
    if (result.weekData) {
      // If it's a string, parse it (backward compatibility)
      weekData = typeof result.weekData === 'string' 
        ? JSON.parse(result.weekData) 
        : result.weekData;
    }
    
    // Add new record
    weekData.push(tabRecord);
    
    // Store updated data (no need to stringify - chrome.storage does this automatically)
    await chrome.storage.local.set({ weekData });
    
    // Clean up old data
    cleanupOldData();
    
  } catch (error) {
    console.error('Error recording tab:', error);
  }
}

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

async function cleanupOldData() {
  try {
    const allData = await chrome.storage.local.get(null);
    // const allData = localStorage.getItem(null);
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - (2 * 7 * 24 * 60 * 60 * 1000));
    
    const keysToRemove = [];
    
    for (const key in allData) {
      if (key.startsWith('week_')) {
        const [, year, month, date] = key.split('_').map(Number);
        const weekDate = new Date(year, month, date);
        
        if (weekDate < twoWeeksAgo) {
          keysToRemove.push(key);
        }
      }
    }
    
    if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
    }
  } catch (error) {
    console.error('Error cleaning up old data:', error);
  }
}