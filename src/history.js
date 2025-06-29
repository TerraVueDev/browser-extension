async function fetchApiData() {
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
}

async function getData() {
  try {
    const result = await chrome.storage.local.get("weekData");
    return result.weekData || [];
  } catch (error) {
    console.error("Error retrieving data:", error);
    return [];
  }
}

function toTitleCase(str) {
  return str.replace(
    /\w\S*/g,
    (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase(),
  );
}

async function displayDomains() {
  try {
    let { urlData, categoryData } = await fetchApiData();

    const data = await getData();
    const domainsWithSubdomains = data.map((item) => item.domain);

    // Process domains to get main domains and names
    const domainInfo = domainsWithSubdomains.map((domain) => {
      const parts = domain.split(".");
      let mainDomain, name;

      if (parts.length > 2) {
        mainDomain = parts.slice(-2).join(".");
        name = toTitleCase(parts.slice(1, -1).join("."));
      } else {
        mainDomain = domain;
        name = toTitleCase(parts[0]);
      }

      return { mainDomain, name, originalDomain: domain };
    });

    // Get unique domains while preserving all needed info
    const uniqueDomains = [];
    const seen = new Set();

    for (const info of domainInfo) {
      if (!seen.has(info.mainDomain)) {
        seen.add(info.mainDomain);
        uniqueDomains.push(info);
      }
    }

    // Count impacts across all unique domains
    let lowCount = 0;
    let mediumCount = 0;
    let highCount = 0;

    uniqueDomains.forEach((domainInfo) => {
      const domainKey = Object.keys(urlData).find(
        (key) =>
          key.includes(domainInfo.mainDomain) ||
          key.includes(domainInfo.originalDomain),
      );

      let category = domainKey ? urlData[domainKey].categories : "unknown";
      let impact = ""; // Default impact

      if (category && categoryData[category]) {
        impact = categoryData[category].impact.toLowerCase();
      }

      switch (impact) {
        case "low":
          lowCount++;
          break;
        case "medium":
          mediumCount++;
          break;
        case "high":
          highCount++;
          break;
      }
    });

    // Display the counts
    const countContainer = document.getElementById("count");
    countContainer.innerHTML = `
      <div class="flex items-center justify-around">
        <div class="text-center">
          <div class="text-lg font-bold text-green-500">${lowCount}</div>
          <div class="text-sm tracking-wide text-gray-600 uppercase">Low</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-bold text-yellow-500">${mediumCount}</div>
          <div class="text-sm tracking-wide text-gray-600 uppercase">Medium</div>
        </div>
        <div class="text-center">
          <div class="text-lg font-bold text-red-500">${highCount}</div>
          <div class="text-sm tracking-wide text-gray-600 uppercase">High</div>
        </div>
      </div>
    `;

    const container = document.getElementById("apps-list");
    container.innerHTML =
      uniqueDomains.length === 0
        ? '<div class="no-data">No tabs recorded this week</div>'
        : uniqueDomains
            .map((domainInfo) => {
              // Find the category for this domain
              const domainKey = Object.keys(urlData).find(
                (key) =>
                  key.includes(domainInfo.mainDomain) ||
                  key.includes(domainInfo.originalDomain),
              );

              let category = domainKey
                ? urlData[domainKey].categories
                : "unknown";
              let impact = ""; // Default impact
              let iconContent = "🌐"; // Default icon

              // Determine impact and icon based on category
              if (category && categoryData[category]) {
                impact = categoryData[category].impact.toLowerCase();
                iconContent = urlData[domainKey].icon
                  ? `<img src="https://cdn.simpleicons.org/${urlData[domainKey].icon}" 
                       height="28" width="28" alt="${urlData[domainKey].icon} icon" />`
                  : "🌐";
              }

              // Get appropriate styling based on impact
              let impactClass, impactText;
              switch (impact) {
                case "low":
                  impactClass = "border-green-600 bg-green-200 text-green-700";
                  impactText = "Low Impact";
                  break;
                case "medium":
                  impactClass =
                    "border-yellow-600 bg-yellow-200 text-yellow-700";
                  impactText = "Medium Impact";
                  break;
                case "high":
                  impactClass = "border-red-600 bg-red-200 text-red-700";
                  impactText = "High Impact";
                  break;
                default:
                  impactClass = "border-gray-600 bg-gray-200 text-gray-700";
                  impactText = "No Data";
              }

              return `
              <div class="flex items-center justify-between py-3 relative">
                  <div class="flex items-center">
                      <div class="mr-4 h-10 w-10 rounded-lg flex items-center justify-center text-2xl">
                          ${iconContent}
                      </div>
                      <span class="text-base font-medium text-gray-800">
                          ${domainInfo.name}
                      </span>
                  </div>
                  <div class="impact-indicator relative">
                      <span class="rounded-full border px-3 py-1 text-sm font-medium ${impactClass}">
                          ${impactText}
                      </span>
                  </div>
              </div>
            `;
            })
            .join("");
  } catch (error) {
    console.error("Error displaying domains:", error);
  }
}

displayDomains();
