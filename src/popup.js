class EnvironmentalImpactAnalyzer {
  constructor() {
    this.session = null;
    this.cache = this.loadCache();
    this.urlData = null;
    this.categoryData = null;
  }

  async getSession(params) {
    if (!this.session) {
      try {
        this.session = await LanguageModel.create(params);
      } catch (e) {
        console.error('Failed to crreate session:', e);
        throw new Error('Language model not available.');
      }
    }

    return this.session
  }

  async runPrompt(prompt, params) {
    try {
      const session = await this.getSession(params)
      return await session.prompt(prompt);
    } catch (e) {
      console.error('Prompt execution failed:', error);
      this.resetSession();
      throw error;
    }
  }

  resetSession() {
    if (this.session) {
      this.session.destroy();
      this.session = null;
    }
  }

  loadCache() {
    try {
      const cached = localStorage.getItem('responseData');
      return cached ? JSON.parse(cached) : {};
    } catch (e) {
      console.warn('Failed to load cache:', e);
      return {};
    }
  }

  saveCache() {
    try {
      localStorage.setItem('responseData', JSON.stringify(this.cache));
    } catch (e) {
      console.warn('Failed to save cache:', e);
    }
  }

  async loadData() {
    try {
      const [urlResponse, categoryResponse] = await Promise.all([
        fetch(chrome.runtime.getURL('url.json')),
        fetch(chrome.runtime.getURL('category.json'))
      ]);

      if (!urlResponse.ok || !categoryResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      this.urlData = await urlResponse.json();
      this.categoryData = await categoryResponse.json();
    } catch (e) {
      console.error('Failed to load data files:', e);
      throw e;
    }
  }

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return tab;
    } catch (e) {
      console.error('Failed to get current tab:', e);
      throw e;
    }
  }

  extractDomainInfo(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const parts = hostname.split('.');

      // Extract domain (last two parts)
      const domain = parts.slice(-2).join('.');
      
      // Extract name for display
      let name;
      if (parts.length > 2) {
        // Has subdomain: www.example.com -> "Example"
        name = this.toTitleCase(parts.slice(1, -1).join('.'));
      } else {
        // No subdomain: bitcoin.org -> "Bitcoin"
        name = this.toTitleCase(parts[0]);
      }

      return { domain, name, hostname };
    } catch (e) {
      console.error('Invalid URL:', e);
      return null;
    }
  }

  toTitleCase(str) {
    return str.replace(/\w\S*/g, text => 
      text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    );
  }

  updateDomainDisplay(domain) {
    const domainElement = document.getElementById('domain');
    if (domainElement) {
      domainElement.textContent = domain;
    }
  }

  updateImpactHeader(impact) {
    const headerElement = document.getElementById('impact-header');
    const impactElement = document.getElementById('impact');

    if (!headerElement || !impactElement) return;

    const impactConfig = {
      low: { class: 'text-white p-4 text-center bg-green-600', text: 'low impact' },
      medium: { class: 'text-white p-4 text-center bg-yellow-600', text: 'medium impact' },
      high: { class: 'text-white p-4 text-center bg-high-orange', text: 'high impact' }
    };

    const config = impactConfig[impact];
    if (config) {
      headerElement.className = config.class;
      impactElement.textContent = config.text;
    }
  }

  updateNoDataDisplay(message = 'No data') {
    const elements = {
      local: document.getElementById('local'),
      localText: document.getElementById('local-text'),
      impactHeader: document.getElementById('impact-header'),
      impact: document.getElementById('impact'),
      factors: document.getElementById('environmental-factors')
    };

    if (elements.local) elements.local.className = 'p-4 text-md font-bold text-gray-900';
    if (elements.localText) elements.localText.textContent = message;
    if (elements.impactHeader) elements.impactHeader.className = 'text-white p-4 text-center bg-gray-900';
    if (elements.impact) elements.impact.textContent = message;
    if (elements.factors) elements.factors.className = 'hidden';
  }

  async generateFactorDescription(name, factorType, value) {
    if (this.cache[name] && this.cache[name][factorType]) {
      return this.cache[name][factorType];
    }

    const prompts = {
      factor1: `Compare ${value} CO2 to other day to day usage. Start your response with: ${name} annual CO2 emission is `,
      factor2: `Compare ${value} watt hour to other day to day usage. Start your response with: ${name} annual power consumption is `
    };

    const params = {
      initialPrompts: [
        {
          role: 'system',
          content: 'Do not use any markdown formatting. Give a brief and concise explanation. Write your answer in one sentence.'
        }
      ],
    };

    try {
      const response = await this.runPrompt(prompts[factorType], params);

      if (!this.cache[name]) {
        this.cache[name] = {};
      }
      this.cache[name][factorType] = response;
      this.saveCache();

      return response;
    } catch (e) {
      console.error(`Failed to generate ${factorType} description:`, e);
      return `Unable to generate ${factorType} comparison`;
    }
  }

  async generateExplanation(name, explanation, value) {
    if (this.cache[name] && this.cache[name][explanation]) {
      return this.cache[name][explanation];
    }

    const prompts = {
      explanation: `Give an explanation why ${name} has an impact to the environment. Start your response with: ${name}'s impact on the environment comes from `
    }

    const params = {
      initialPrompts: [
        {
          role: 'system',
          content: 'Do not use any markdown formatting. Give a brief and concise explanation. Write your answer maximum of 2 short paragraph.'
        }
      ],
    };

    try {
      const response = await this.runPrompt(prompts[explanation], params);

      if (!this.cache[name]) {
        this.cache[name] = {};
      }
      this.cache[name][explanation] = response;
      this.saveCache();

      return response;
    } catch (e) {
      console.error(`Failed to generate ${explanation}:`, e);
      return `Unable to generate ${explanation} explanation`;
    }
  }

  async updateFactorDisplay(name, factorType, value) {
    const elementId = `${factorType}-desc`;
    const element = document.getElementById(elementId);
    

    if (!element) return;

    try {
      const description = await this.generateFactorDescription(name, factorType, value);
      element.textContent = description;
    } catch (e) {
      console.error(`Failed to update ${factorType} description:`, e);
      element.textContent = `Unable to generate ${factorType} comparison`;
    }
  }

  async updateExplanationDisplay(name, explanation, value) {
    const titleId = `${explanation}-title`;
    const titleElement = document.getElementById(titleId);
    const descId = `${explanation}-desc`;
    const descElement = document.getElementById(descId);

    if (!titleElement || !descElement) return;

    try {
      titleElement.textContent = `Why ${name} has a ${value} impact?`;
      const description = await this.generateExplanation(name, explanation, value);
      descElement.textContent = description;
    } catch (e) {
      console.error(`Failed to update ${explanation} description:`, e);
      titleElement.textContent = `Why ${name} has a ${value} impact?`;
      descElement.textContent = `Unable to generate ${explanation} explanation`;
    }
  }

  // Special URL handling
  isSpecialUrl(url) {
    return url.startsWith('chrome:') || url.startsWith('file:');
  }

  // Main analysis method
  async analyzeCurrentPage() {
    try {
      // Check if LanguageModel is available
      if (!('LanguageModel' in self)) {
        this.updateNoDataDisplay('Model not available');
        return;
      }

      // Initialize defaults
      try {
        const defaults = await LanguageModel.params();
        console.log('Model default:', defaults);
      } catch (e) {
        console.error('Failed to fetch model defaults:', e);
      }

      await this.loadData();

      // Get current tab info
      const tab = await this.getCurrentTab();
      const domainInfo = this.extractDomainInfo(tab.url);

      if (!domainInfo) {
        this.updateNoDataDisplay('Invalid URL');
        return;
      }

      const { domain, name } = domainInfo;
      this.updateDomainDisplay(domain);

      if (this.isSpecialUrl(tab.url)) {
        this.updateNoDataDisplay('No impact');
        return;
      }

      // Check if the domain is in the JSON
      if (!(domain in this.urlData)) {
        this.updateNoDataDisplay('No data');
        return;
      }

      // Get category data
      const categoryKey = this.urlData[domain];
      const categoryInfo = this.categoryData[categoryKey];

      if (!categoryInfo) {
        this.updateNoDataDisplay('Category data missing');
        return;
      }

      // Update impact display
      this.updateImpactHeader(categoryInfo.impact);

      await Promise.all([
        this.updateFactorDisplay(name, 'factor1', categoryInfo.co2),
        this.updateFactorDisplay(name, 'factor2', categoryInfo.wh),
        this.updateExplanationDisplay(name, 'explanation', categoryInfo.impact)
      ]);
    } catch (e) {
      console.error('Failed to analyze current page:', e);
    }
  }

  destroy() {
    this.resetSession();
  }
}

const analyzer = new EnvironmentalImpactAnalyzer();

analyzer.analyzeCurrentPage().catch(e => {
  console.error('Failed to analyze current page:', e)
});

window.addEventListener('beforeunload', () => {
  analyzer.destroy();
});