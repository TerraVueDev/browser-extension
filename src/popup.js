(async () => {
  // Fetch the JSON file from the extension's directory
  const data = await fetch(chrome.runtime.getURL('info.json'))
  let obj = await data.json();

  // Get URL of the current active tab
  const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
  let url = tab.url;
  let hostname = new URL(tab.url).hostname;

  // Take the last two parts of the hostname as the domain (example.com)
  let domain = hostname.split('.')
    .slice(-2)
    .join('.');

  let parts = hostname.split('.');
  let name;

  if (parts.length > 2) {
    // Has subdomain: www.example.com -> "example"
    name = parts.slice(1, -1).join('.');
  } else {
    // No subdomain: bitcoin.org -> "bitcoin"
    name = parts[0];
  }

  document.getElementById('domain').innerHTML = domain;

  if (name in obj) {
    document.getElementById('impact').innerHTML = obj[name]['impact'] + ' impact';
    document.getElementById('twh').innerHTML = obj[name]['twh'];
    document.getElementById('co2').innerHTML = obj[name]['co2'];
    document.getElementById('factor1-title').innerHTML = obj[name]['factor1-title'];
    document.getElementById('factor1-desc').innerHTML = obj[name]['factor1-desc'];
    document.getElementById('factor2-title').innerHTML = obj[name]['factor2-title'];
    document.getElementById('factor2-desc').innerHTML = obj[name]['factor2-desc'];

    switch (obj[name]['impact']) {
      case 'low':
        document.getElementById('impact-header').className = "text-white p-4 text-center bg-green-600";
        break;
      case 'medium':
        document.getElementById('impact-header').className = "text-white p-4 text-center bg-yellow-600";
        break;
      case 'high':
        document.getElementById('impact-header').className = "text-white p-4 text-center bg-high-orange";
        break;
      default:
        break;
    }
  } else if (url.split('/')[0] === 'chrome:' || url.split('/')[0] === 'file:') {
    // Handle special cases for Chrome and file URLs
    document.getElementById('stats-container').style.display = 'none';
    document.getElementById('local').className = "p-4 text-md font-bold text-gray-900";
    document.getElementById('impact-header').className = "text-white p-4 text-center bg-gray-900";
    document.getElementById('impact').innerHTML = 'No impact';
  } else {
    // Handle case where the domain is not found in the JSON
    document.getElementById('stats-container').style.display = 'none';
    document.getElementById('local').className = "p-4 text-md font-bold text-gray-900";
    document.getElementById('local-text').innerHTML = 'No data.';
    document.getElementById('impact-header').className = "text-white p-4 text-center bg-gray-900";
    document.getElementById('impact').innerHTML = 'No data';
  }
})();