// ⚠️ Educational only — misuse can get you banned.

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const proxyChain = require('proxy-chain');
const axios = require('axios');

puppeteer.use(StealthPlugin());

(async () => {
  // Load user agent lists
  const [ua_android, ua_desktop, ua_ios, ua_macos, ua_linux] = await Promise.all([
    axios.get('https://raw.githubusercontent.com/HyperBeats/User-Agent-List/main/useragents-android.txt').then(res => res.data.split('\n').filter(Boolean)),
    axios.get('https://raw.githubusercontent.com/HyperBeats/User-Agent-List/main/useragents-desktop.txt').then(res => res.data.split('\n').filter(Boolean)),
    axios.get('https://raw.githubusercontent.com/HyperBeats/User-Agent-List/main/useragents-ios.txt').then(res => res.data.split('\n').filter(Boolean)),
    axios.get('https://raw.githubusercontent.com/HyperBeats/User-Agent-List/main/useragents-macos.txt').then(res => res.data.split('\n').filter(Boolean)),
    axios.get('https://raw.githubusercontent.com/HyperBeats/User-Agent-List/main/useragents-linux.txt').then(res => res.data.split('\n').filter(Boolean))
  ]);
  const userAgents = [...ua_android, ...ua_desktop, ...ua_ios, ...ua_macos, ...ua_linux];

  while (true) {
    const proxyLists = await Promise.all([
      axios.get('https://raw.githubusercontent.com/dpangestuw/Free-Proxy/refs/heads/main/socks5_proxies.txt').then(res => res.data.split('\n').filter(Boolean)),
      axios.get('https://raw.githubusercontent.com/casa-ls/proxy-list/refs/heads/main/socks5').then(res => res.data.split('\n').filter(Boolean)),
      axios.get('https://raw.githubusercontent.com/Tsprnay/Proxy-lists/master/proxies/https.txt').then(res => res.data.split('\n').filter(Boolean)),
      axios.get('https://raw.githubusercontent.com/Tsprnay/Proxy-lists/master/proxies/socks5.txt').then(res => res.data.split('\n').filter(Boolean)),
      axios.get('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all').then(res => res.data.split('\n').filter(Boolean))
    ]);
    const proxies = [...proxyLists[0], ...proxyLists[1], ...proxyLists[2], ...proxyLists[3], ...proxyLists[4]].slice(0, 50);

    let targets = await axios.get('https://raw.githubusercontent.com/virkx3/igbot/refs/heads/main/tiktoklinks.txt?token=GHSAT0AAAAAADGHCPMFMZHM23A6VHVPDPNQ2DXLAKQ').then(res => res.data.split('\n').filter(Boolean));
    let viewCounts = {};
    targets.forEach(url => viewCounts[url] = 0);

    let active = true;

    while (active) {
      for (let targetUrl of targets) {
        if (viewCounts[targetUrl] >= 5000) continue;

        const proxy = proxies[Math.floor(Math.random() * proxies.length)];
        const ua = userAgents[Math.floor(Math.random() * userAgents.length)];

        console.log(`Using proxy: ${proxy}`);
        console.log(`Using UA: ${ua}`);
        console.log(`Opening: ${targetUrl}`);

        const newProxyUrl = await proxyChain.anonymizeProxy(`socks5://${proxy}`);

        const browser = await puppeteer.launch({
          headless: true,
          args: [
            `--proxy-server=${newProxyUrl}`,
            '--no-sandbox',
            '--disable-setuid-sandbox'
          ]
        });

        const page = await browser.newPage();
        await page.setUserAgent(ua);

        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForTimeout(1000 + Math.floor(Math.random() * 2000));

        await browser.close();

        viewCounts[targetUrl]++;
        console.log(`Views for ${targetUrl}: ${viewCounts[targetUrl]}`);
      }

      active = Object.values(viewCounts).some(count => count < 5000);

      if (!active) {
        console.log('All targets reached 5000 views. Waiting for new targets...');
        await new Promise(res => setTimeout(res, 5 * 60 * 1000));
        targets = await axios.get('https://raw.githubusercontent.com/virkx3/igbot/refs/heads/main/tiktoklinks.txt?token=GHSAT0AAAAAADGHCPMFMZHM23A6VHVPDPNQ2DXLAKQ').then(res => res.data.split('\n').filter(Boolean));
        targets.forEach(url => {
          if (!(url in viewCounts)) viewCounts[url] = 0;
        });
        active = Object.values(viewCounts).some(count => count < 5000);
      }
    }
  }
})();
