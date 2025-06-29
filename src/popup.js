// State management
const createState = () => ({
  session: null,
  cache: loadCache(),
  urlData: null,
  categoryData: null,
  apiDataCacheKey: "apiData",
  cacheExpiry: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
});

let state = createState();

// Session management
const getSession = async (params) => {
  if (!state.session) {
    try {
      state.session = await LanguageModel.create(params);
    } catch (e) {
      console.error("Failed to create session:", e);
      throw new Error("Language model not available.");
    }
  }
  return state.session;
};

const runPrompt = async (prompt, params) => {
  try {
    const session = await getSession(params);
    return await session.prompt(prompt);
  } catch (e) {
    console.error("Prompt execution failed:", e);
    resetSession();
    throw e;
  }
};

const resetSession = () => {
  if (state.session) {
    state.session.destroy();
    state.session = null;
  }
};

// Cache management
function loadCache() {
  try {
    const cached = localStorage.getItem("responseData");
    return cached ? JSON.parse(cached) : {};
  } catch (e) {
    console.warn("Failed to load cache:", e);
    return {};
  }
}

const saveCache = () => {
  try {
    localStorage.setItem("responseData", JSON.stringify(state.cache));
  } catch (e) {
    console.warn("Failed to save cache:", e);
  }
};

const loadApiDataFromCache = () => {
  try {
    const cachedData = localStorage.getItem(state.apiDataCacheKey);
    if (!cachedData) return null;

    const parsed = JSON.parse(cachedData);
    const now = Date.now();

    // Check if cache has expired
    if (parsed.timestamp && now - parsed.timestamp > state.cacheExpiry) {
      console.log("API data cache expired, will fetch fresh data");
      localStorage.removeItem(state.apiDataCacheKey);
      return null;
    }

    return parsed.data;
  } catch (e) {
    console.warn("Failed to load API data from cache:", e);
    return null;
  }
};

const saveApiDataToCache = (urlData, categoryData) => {
  try {
    const cacheData = {
      data: { urlData, categoryData },
      timestamp: Date.now(),
    };
    localStorage.setItem(state.apiDataCacheKey, JSON.stringify(cacheData));
    console.log("API data saved to cache");
  } catch (e) {
    console.warn("Failed to save API data to cache:", e);
  }
};

// API data fetching
const fetchApiData = async () => {
  const [urlResponse, categoryResponse] = await Promise.all([
    fetch(
      "https://raw.githubusercontent.com/TerraVueDev/assets/refs/heads/main/links.json",
    ).then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch links data");
      }
      return response.json();
    }),

    fetch(
      "https://raw.githubusercontent.com/TerraVueDev/assets/refs/heads/main/categories.json",
    ).then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch categories data");
      }
      return response.json();
    }),
  ]);

  return { urlData: urlResponse, categoryData: categoryResponse };
};

const loadData = async () => {
  try {
    // First try to load from cache
    const cachedData = loadApiDataFromCache();

    if (cachedData) {
      state.urlData = cachedData.urlData;
      state.categoryData = cachedData.categoryData;
      return;
    }

    // If no cached data or expired, fetch from API
    const { urlData, categoryData } = await fetchApiData();

    state.urlData = urlData;
    state.categoryData = categoryData;

    // Save to cache for future use
    saveApiDataToCache(urlData, categoryData);
  } catch (e) {
    console.error("Failed to load data:", e);

    // Try to load expired cache as fallback
    try {
      const fallbackData = localStorage.getItem(state.apiDataCacheKey);
      if (fallbackData) {
        const parsed = JSON.parse(fallbackData);
        if (parsed.data) {
          console.log("Using expired cache as fallback");
          state.urlData = parsed.data.urlData;
          state.categoryData = parsed.data.categoryData;
          return;
        }
      }
    } catch (fallbackError) {
      console.warn("Fallback cache load failed:", fallbackError);
    }

    throw e;
  }
};

// API data management
const refreshApiData = async () => {
  try {
    console.log("Manually refreshing API data");
    const { urlData, categoryData } = await fetchApiData();

    state.urlData = urlData;
    state.categoryData = categoryData;

    saveApiDataToCache(urlData, categoryData);
    console.log("API data refreshed successfully");

    return true;
  } catch (e) {
    console.error("Failed to refresh API data:", e);
    return false;
  }
};

const clearApiDataCache = () => {
  try {
    localStorage.removeItem(state.apiDataCacheKey);
    console.log("API data cache cleared");
  } catch (e) {
    console.warn("Failed to clear API data cache:", e);
  }
};

// Tab and URL utilities
const getCurrentTab = async () => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    return tab;
  } catch (e) {
    console.error("Failed to get current tab:", e);
    throw e;
  }
};

const extractDomainInfo = (url) => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const parts = hostname.split(".");

    // Extract domain (last two parts)
    const domain = parts.slice(-2).join(".");

    // Extract name for display
    let name;
    if (parts.length > 2) {
      // Has subdomain: www.example.com -> "Example"
      name = toTitleCase(parts.slice(1, -1).join("."));
    } else {
      // No subdomain: bitcoin.org -> "Bitcoin"
      name = toTitleCase(parts[0]);
    }

    return { domain, name, hostname };
  } catch (e) {
    console.error("Invalid URL:", e);
    return null;
  }
};

const toTitleCase = (str) => {
  return str.replace(
    /\w\S*/g,
    (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase(),
  );
};

const isSpecialUrl = (url) => {
  return url.startsWith("chrome:") || url.startsWith("file:");
};

// DOM update functions
const updateDomainDisplay = (domain) => {
  const domainElement = document.getElementById("domain");
  if (domainElement) {
    domainElement.textContent = domain;
  }
};

const updateImpactHeader = (impact) => {
  const headerElement = document.getElementById("impact-header");
  const impactElement = document.getElementById("impact");

  if (!headerElement || !impactElement) return;

  const impactConfig = {
    low: {
      class: "text-white p-4 text-center bg-green-600",
      text: "low impact",
    },
    medium: {
      class: "text-white p-4 text-center bg-yellow-600",
      text: "medium impact",
    },
    high: {
      class: "text-white p-4 text-center bg-orange-500",
      text: "high impact",
    },
  };

  const config = impactConfig[impact];
  if (config) {
    headerElement.className = config.class;
    impactElement.textContent = config.text;
  }
};

const updateNoDataDisplay = (message = "No data") => {
  const elements = {
    local: document.getElementById("local"),
    localText: document.getElementById("local-text"),
    impactHeader: document.getElementById("impact-header"),
    impact: document.getElementById("impact"),
    factors: document.getElementById("environmental-factors"),
  };

  if (elements.local)
    elements.local.className = "p-4 text-md font-bold text-gray-900";
  if (elements.localText) elements.localText.textContent = message;
  if (elements.impactHeader)
    elements.impactHeader.className = "text-white p-4 text-center bg-gray-900";
  if (elements.impact) elements.impact.textContent = message;
  if (elements.factors) elements.factors.className = "hidden";
};

const updateLinks = async (domain) => {
  const sourceLink = document.getElementById("source-link");

  if (!sourceLink) return;

  sourceLink.href = `https://terravue.app/details.html?website=${domain}`;
};

// Content generation functions
const generateFactorDescription = async (name, factorType, value) => {
  if (state.cache[name] && state.cache[name][factorType]) {
    return state.cache[name][factorType];
  }

  const prompts = {
    factor1: `Compare ${value} CO2 to other day to day usage. Start your response with: ${name} annual CO2 emission is `,
    factor2: `Compare ${value} watt hour to other day to day usage. Start your response with: ${name} annual power consumption is `,
  };

  const params = {
    initialPrompts: [
      {
        role: "system",
        content:
          "Do not use any markdown formatting. Give a brief and concise explanation. Write your answer in one sentence.",
      },
    ],
  };

  try {
    const response = await runPrompt(prompts[factorType], params);

    if (!state.cache[name]) {
      state.cache[name] = {};
    }
    state.cache[name][factorType] = response;
    saveCache();

    return response;
  } catch (e) {
    console.error(`Failed to generate ${factorType} description:`, e);
    return `Unable to generate ${factorType} comparison`;
  }
};

const generateExplanation = async (name, explanation, value) => {
  if (state.cache[name] && state.cache[name][explanation]) {
    return state.cache[name][explanation];
  }

  const prompts = {
    explanation: `Give an explanation why ${name} has an impact to the environment. Start your response with: ${name}'s impact on the environment comes from `,
  };

  const params = {
    initialPrompts: [
      {
        role: "system",
        content:
          "Do not use any markdown formatting. Give a brief and concise explanation. Write your answer maximum of 2 short paragraph.",
      },
    ],
  };

  try {
    const response = await runPrompt(prompts[explanation], params);

    if (!state.cache[name]) {
      state.cache[name] = {};
    }
    state.cache[name][explanation] = response;
    saveCache();

    return response;
  } catch (e) {
    console.error(`Failed to generate ${explanation}:`, e);
    return `Unable to generate ${explanation} explanation`;
  }
};

const updateFactorDisplay = async (name, factorType, value) => {
  const elementId = `${factorType}-desc`;
  const element = document.getElementById(elementId);

  if (!element) return;

  try {
    const description = await generateFactorDescription(
      name,
      factorType,
      value,
    );
    element.textContent = description;
  } catch (e) {
    console.error(`Failed to update ${factorType} description:`, e);
    element.textContent = `Unable to generate ${factorType} comparison`;
  }
};

const updateExplanationDisplay = async (name, explanation, value) => {
  const titleId = `${explanation}-title`;
  const titleElement = document.getElementById(titleId);
  const descId = `${explanation}-desc`;
  const descElement = document.getElementById(descId);

  if (!titleElement || !descElement) return;

  try {
    titleElement.textContent = `Why ${name} has a ${value} impact?`;
    const description = await generateExplanation(name, explanation, value);
    descElement.textContent = description;
  } catch (e) {
    console.error(`Failed to update ${explanation} description:`, e);
    titleElement.textContent = `Why ${name} has a ${value} impact?`;
    descElement.textContent = `Unable to generate ${explanation} explanation`;
  }
};

// Main analysis function
const analyzeCurrentPage = async () => {
  try {
    // Check if LanguageModel is available
    if (!("LanguageModel" in self)) {
      updateNoDataDisplay("Model not available");
      return;
    }

    // Initialize defaults
    try {
      const defaults = await LanguageModel.params();
    } catch (e) {
      console.error("Failed to fetch model defaults:", e);
    }

    await loadData();

    // Get current tab info
    const tab = await getCurrentTab();
    const domainInfo = extractDomainInfo(tab.url);

    if (!domainInfo) {
      updateNoDataDisplay("Invalid URL");
      return;
    }

    const { domain, name } = domainInfo;
    updateDomainDisplay(domain);

    if (isSpecialUrl(tab.url)) {
      updateNoDataDisplay("No impact");
      return;
    }

    // Check if the domain is in the JSON
    if (!(domain in state.urlData)) {
      updateNoDataDisplay("No data");
      return;
    }

    // Get category data
    const categoryKey = state.urlData[domain]["categories"];
    const categoryInfo = state.categoryData[categoryKey];

    if (!categoryInfo) {
      updateNoDataDisplay("Category data missing");
      return;
    }

    // Update impact display
    console.log("Category info:", categoryInfo.impact);
    updateImpactHeader(categoryInfo.impact);

    await Promise.all([
      updateFactorDisplay(name, "factor1", categoryInfo.co2),
      updateFactorDisplay(name, "factor2", categoryInfo.wh),
      updateExplanationDisplay(name, "explanation", categoryInfo.impact),
      updateLinks(domain),
    ]);
  } catch (e) {
    console.error("Failed to analyze current page:", e);
  }
};

// Cleanup function
const destroy = () => {
  resetSession();
};

// Initialize the application
analyzeCurrentPage().catch((e) => {
  console.error("Failed to analyze current page:", e);
});

window.addEventListener("beforeunload", () => {
  destroy();
});

// Expose methods globally for debugging/manual control
window.envAnalyzer = {
  refreshData: refreshApiData,
  clearCache: clearApiDataCache,
  analyzeCurrentPage,
  destroy,
};
