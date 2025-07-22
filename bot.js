const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const net = require('net');
const { setTimeout } = require('timers/promises');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

// GitHub configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // Format: owner/repo
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

// Proxy sources
const PROXY_SOURCES = [
    'https://proxylist.geonode.com/api/proxy-list?limit=500&page=1&sort_by=lastChecked&sort_type=desc',
    'https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&protocol=http',
];

const USER_AGENT_SOURCES = [
    'https://raw.githubusercontent.com/tamimibrahim17/List-of-user-agents/master/Chrome.txt',
    'https://gist.githubusercontent.com/pzb/b4b6f57144aea7827ae4/raw/cf847b76a142955b1410c8bcef3aabe221a63db1/user-agents.txt'
];

class ProxyManager {
    constructor() {
        this.proxies = [];
        this.workingProxies = [];
    }

    async initialize() {
        console.log('🔍 Fetching proxies...');
        await this.refreshProxies();
    }

    async refreshProxies() {
        try {
            const results = await Promise.allSettled(
                PROXY_SOURCES.map(url => this.fetchProxies(url))
            );
            
            this.proxies = results.flatMap(result => 
                result.status === 'fulfilled' ? result.value : []
            );
            
            console.log(`💾 Loaded ${this.proxies.length} proxies`);
        } catch (error) {
            console.error('Failed to fetch proxies:', error.message);
            this.proxies = [];
        }
    }

    async fetchProxies(url) {
        try {
            if (url.includes('geonode')) {
                const response = await axios.get(url, { timeout: 10000 });
                return response.data.data.map(p => `${p.ip}:${p.port}`);
            }
            
            const response = await axios.get(url, { timeout: 10000 });
            return response.data.split(/\r?\n/)
                .map(p => p.trim())
                .filter(p => p && net.isIP(p.split(':')[0]) !== 0);
        } catch {
            return [];
        }
    }

    async testProxyConnectivity(proxy) {
        return new Promise(resolve => {
            const [host, port] = proxy.split(':');
            const socket = net.createConnection({
                host: host,
                port: parseInt(port),
                timeout: 10000
            });
            
            socket.on('connect', () => {
                socket.end();
                resolve(true);
            });
            
            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            
            socket.on('error', () => resolve(false));
        });
    }

    async testProxyWithTikTok(proxy) {
        try {
            const agent = new HttpsProxyAgent(`http://${proxy}`);
            await axios.get('https://www.tiktok.com', {
                timeout: 15000,
                httpsAgent: agent,
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });
            return true;
        } catch (error) {
            if (error.response && error.response.status === 403) {
                return true;
            }
            return false;
        }
    }

    async verifyProxy(proxy) {
        const isAlive = await this.testProxyConnectivity(proxy);
        if (!isAlive) return false;
        return this.testProxyWithTikTok(proxy);
    }

    async findWorkingProxies(requiredCount = 3, maxTests = 1000) {
        console.log('🧪 Verifying proxies...');
        
        const shuffledProxies = [...this.proxies].sort(() => 0.5 - Math.random());
        let tested = 0;
        let found = 0;
        
        for (const proxy of shuffledProxies) {
            if (found >= requiredCount || tested >= maxTests) break;
            
            tested++;
            const isValid = await this.verifyProxy(proxy);
            
            if (isValid) {
                found++;
                this.workingProxies.push(proxy);
                console.log(`✅ Working proxy: ${proxy} (${found}/${requiredCount})`);
            }
            
            if (tested % 50 === 0) {
                console.log(`   Tested ${tested} proxies, found ${found} working`);
            }
        }
        
        console.log(`🔚 Tested ${tested} proxies, found ${found} working`);
        return this.workingProxies;
    }

    getRandomProxy() {
        if (this.workingProxies.length > 0) {
            return this.workingProxies[Math.floor(Math.random() * this.workingProxies.length)];
        }
        return null;
    }
}

class UserAgentManager {
    constructor() {
        this.userAgents = [];
    }

    async initialize() {
        console.log('🔍 Fetching user agents...');
        try {
            const results = await Promise.allSettled(
                USER_AGENT_SOURCES.map(url => this.fetchUserAgents(url))
            );
            
            this.userAgents = results.flatMap(result => 
                result.status === 'fulfilled' ? result.value : []
            );
            
            console.log(`💾 Loaded ${this.userAgents.length} user agents`);
        } catch (error) {
            console.error('Failed to fetch user agents:', error.message);
            this.userAgents = this.getDefaultUserAgents();
        }
    }

    async fetchUserAgents(url) {
        try {
            const response = await axios.get(url, { timeout: 10000 });
            return response.data.split(/\r?\n/)
                .map(ua => ua.trim())
                .filter(ua => ua.length > 0);
        } catch {
            return [];
        }
    }

    getDefaultUserAgents() {
        return [
            // Mobile agents
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
            // Desktop agents
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/112.0'
        ];
    }

    getRandomUserAgent() {
        if (this.userAgents.length > 0) {
            return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
        }
        return this.getDefaultUserAgents()[0];
    }
}

class VideoManager {
    constructor() {
        this.videos = [];
    }

    async initialize() {
        console.log('🔍 Fetching TikTok videos...');
        try {
            const response = await axios.get(
                'https://raw.githubusercontent.com/virkx3/otp/main/tiktok.txt',
                { timeout: 10000 }
            );
            this.videos = response.data.split('\n')
                .map(v => v.trim())
                .filter(v => v.length > 0 && v.startsWith('https://www.tiktok.com/'));
            
            if (this.videos.length === 0) {
                this.videos = this.getDefaultVideos();
            }
        } catch {
            this.videos = this.getDefaultVideos();
        }
        console.log(`💾 Loaded ${this.videos.length} TikTok videos`);
    }

    getDefaultVideos() {
        return [
            'https://www.tiktok.com/@tiktok/video/7106681361892453637',
            'https://www.tiktok.com/@tiktok/video/7107040005863484677'
        ];
    }

    getRandomVideo() {
        return this.videos[Math.floor(Math.random() * this.videos.length)];
    }
}

class GitHubUploader {
    constructor() {
        if (!GITHUB_TOKEN || !GITHUB_REPO) {
            console.warn('⚠️ GitHub credentials missing. Screenshots will be saved locally only.');
            this.enabled = false;
            return;
        }
        
        this.enabled = true;
        [this.repoOwner, this.repoName] = GITHUB_REPO.split('/');
        if (!this.repoOwner || !this.repoName) {
            console.warn('⚠️ Invalid GITHUB_REPO format. Should be "owner/repo"');
            this.enabled = false;
        }
    }

    async uploadScreenshot(filePath, sessionId) {
        if (!this.enabled) {
            console.log('   ⚠️ GitHub uploader disabled');
            return null;
        }
        
        try {
            const fileName = `screenshot-${sessionId}-${Date.now()}.png`;
            const fileContent = fs.readFileSync(filePath);
            const contentBase64 = fileContent.toString('base64');
            
            const response = await axios.put(
                `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/screenshots/${fileName}`,
                {
                    message: `Add screenshot for session ${sessionId}`,
                    content: contentBase64,
                    branch: GITHUB_BRANCH
                },
                {
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'TikTok Viewer'
                    }
                }
            );
            
            console.log(`   📸 Screenshot uploaded to GitHub: ${response.data.content.html_url}`);
            return response.data.content.html_url;
        } catch (error) {
            console.error('   ⚠️ Failed to upload screenshot to GitHub:', error.message);
            return null;
        }
    }
}

class SessionRunner {
    constructor(proxyManager, userAgentManager, videoManager, githubUploader) {
        this.proxyManager = proxyManager;
        this.userAgentManager = userAgentManager;
        this.videoManager = videoManager;
        this.githubUploader = githubUploader;
        this.screenshotDir = path.join(__dirname, 'screenshots');
    }

    async ensureScreenshotDir() {
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }
    }

    async runSession(sessionId) {
        const proxy = this.proxyManager.getRandomProxy();
        const userAgent = this.userAgentManager.getRandomUserAgent();
        let video = this.videoManager.getRandomVideo();

        console.log(`\n🚀 Starting session #${sessionId}`);
        console.log(`   Proxy: ${proxy || 'DIRECT CONNECTION'}`);
        console.log(`   Video: ${video}`);
        console.log(`   User Agent: ${userAgent.slice(0, 60)}...`);

        const browserArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-breakpad',
            '--disable-client-side-phishing-detection',
            '--disable-component-update',
            '--disable-default-apps',
            '--disable-extensions',
            '--disable-hang-monitor',
            '--disable-ipc-flooding-protection',
            '--disable-popup-blocking',
            '--disable-prompt-on-repost',
            '--disable-renderer-backgrounding',
            '--disable-sync',
            '--disable-translate',
            '--metrics-recording-only',
            '--no-first-run',
            '--safebrowsing-disable-auto-update',
            '--mute-audio',
            `--user-agent=${userAgent}`
        ];

        if (proxy) {
            browserArgs.push(`--proxy-server=http://${proxy}`);
        }

        const browser = await puppeteer.launch({
            headless: "new",
            args: browserArgs,
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();
        let pageClosed = false;
        
        try {
            await this.ensureScreenshotDir();
            
            // Set random viewport (mobile-first)
            const isMobile = Math.random() > 0.3;
            const width = isMobile ? 375 : Math.floor(Math.random() * (1920 - 1200)) + 1200;
            const height = isMobile ? 812 : Math.floor(Math.random() * (1080 - 800)) + 800;
            await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile });

            // Set stealth parameters
            await page.evaluateOnNewDocument(() => {
                delete navigator.__proto__.webdriver;
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
                Object.defineProperty(navigator, 'hardwareConcurrency', {
                    get: () => Math.floor(Math.random() * 4) + 2,
                });
            });

            // Block unnecessary resources
            await page.setRequestInterception(true);
            page.on('request', req => {
                const resourceType = req.resourceType();
                if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            console.log(`   🌐 Navigating to video...`);
            try {
                // Convert vm.tiktok.com links to permanent format
                if (video.includes('vm.tiktok.com')) {
                    const response = await axios.head(video, { 
                        timeout: 10000,
                        maxRedirects: 0,
                        validateStatus: status => status >= 300 && status < 400
                    });
                    
                    if (response.headers.location) {
                        video = response.headers.location;
                        console.log(`   🔄 Converted to permanent URL: ${video}`);
                    }
                }

                await page.goto(video, {
                    waitUntil: 'domcontentloaded',
                    timeout: 60000
                });
            } catch (navError) {
                console.error(`   🚫 Navigation error: ${navError.message}`);
                throw new Error('Navigation failed');
            }

            await this.handleTikTokDialogs(page);

            // TikTok video detection
            console.log(`   ⏳ Checking for video player...`);
            let playerFound = false;
            
            try {
                // TikTok video player detection
                await page.waitForSelector('video', { timeout: 10000 });
                playerFound = true;
                console.log('   ✅ Found video element');
            } catch (err) {
                console.log('   ⚠️ Video element not found, trying fallback');
            }
            
            if (!playerFound) {
                try {
                    playerFound = await page.evaluate(() => {
                        return !!document.querySelector('video') || 
                               !!document.querySelector('.tiktok-video-player') ||
                               !!document.querySelector('[data-e2e="video-player"]');
                    });
                    
                    if (playerFound) {
                        console.log('   ✅ Video player detected via JavaScript');
                    } else {
                        console.log('   ❌ Video player not found via JavaScript');
                    }
                } catch (err) {
                    console.log('   ⚠️ Could not detect video player with JavaScript');
                }
            }
            
            if (!playerFound) {
                const errorText = await page.evaluate(() => {
                    return document.querySelector('.error-message')?.textContent.trim() || 
                           document.querySelector('.tiktok-error')?.textContent.trim() || 
                           document.querySelector('body')?.innerText?.slice(0, 200) || 'Unknown error';
                });
                
                throw new Error(`Video player not found. Page content: ${errorText}`);
            }

            // Simulate TikTok viewing behavior
            await this.simulateTikTokBehavior(page);

            const watchTime = Math.floor(Math.random() * (45000 - 15000)) + 15000;
            console.log(`   ⏱️ Watching for ${Math.round(watchTime/1000)} seconds`);
            
            // Simulate activity during viewing
            const startTime = Date.now();
            while (Date.now() - startTime < watchTime) {
                await this.simulateTikTokBehavior(page);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            console.log(`✅ Session #${sessionId} completed`);
            return true;
        } catch (error) {
            console.error(`   ⚠️ Session error: ${error.message}`);
            
            // Save screenshot on error
            try {
                if (!pageClosed && !page.isClosed()) {
                    const screenshotPath = path.join(this.screenshotDir, `error-${sessionId}.png`);
                    await page.screenshot({ path: screenshotPath });
                    console.log(`   📸 Saved error screenshot to ${screenshotPath}`);
                    
                    // Upload to GitHub
                    if (this.githubUploader && typeof this.githubUploader.uploadScreenshot === 'function') {
                        await this.githubUploader.uploadScreenshot(screenshotPath, sessionId);
                    } else {
                        console.log('   ⚠️ GitHub uploader not available');
                    }
                } else {
                    console.log('   ⚠️ Page closed, cannot take screenshot');
                }
            } catch (screenshotError) {
                console.error('   ⚠️ Failed to save screenshot:', screenshotError.message);
            }
            
            return false;
        } finally {
            try {
                if (!pageClosed) {
                    await page.close().catch(() => {});
                }
                await browser.close();
            } catch (browserError) {
                console.error('   ⚠️ Browser close error:', browserError.message);
            }
            pageClosed = true;
        }
    }

    async handleTikTokDialogs(page) {
        try {
            // Handle login prompt
            await page.waitForSelector('[data-e2e="modal-close-inner-button"]', { timeout: 5000 });
            await page.click('[data-e2e="modal-close-inner-button"]');
            console.log('   ✅ Closed login prompt');
        } catch {}

        try {
            // Handle GDPR consent
            await page.waitForSelector('.tiktok-gdpr-btn', { timeout: 3000 });
            await page.evaluate(() => {
                const buttons = document.querySelectorAll('.tiktok-gdpr-btn');
                for (const btn of buttons) {
                    if (btn.textContent.includes('Accept')) {
                        btn.click();
                        return;
                    }
                }
            });
            console.log('   ✅ Accepted GDPR consent');
        } catch {}
    }

    async simulateTikTokBehavior(page) {
        try {
            // Random scrolling behavior
            if (Math.random() > 0.7) {
                const scrollAmount = Math.floor(Math.random() * 300) + 100;
                await page.mouse.wheel({ deltaY: scrollAmount });
                console.log('   🖱️ Scrolled feed');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Random interactions
            if (Math.random() > 0.8) {
                // Like action
                await page.waitForSelector('[data-e2e="like-icon"]', { timeout: 3000 });
                await page.click('[data-e2e="like-icon"]');
                console.log('   ❤️ Liked video');
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            if (Math.random() > 0.9) {
                // Follow action
                await page.waitForSelector('[data-e2e="follow-button"]', { timeout: 3000 });
                await page.click('[data-e2e="follow-button"]');
                console.log('   ➕ Followed creator');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Random swipe gesture (mobile simulation)
            if (page.viewport().isMobile && Math.random() > 0.6) {
                const height = page.viewport().height;
                await page.touchscreen.tap(200, height * 0.8);
                await page.touchscreen.swipe(200, height * 0.8, 200, height * 0.2);
                console.log('   👆 Simulated swipe');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            // Random pause/play
            if (Math.random() > 0.75) {
                await page.keyboard.press('Space');
                console.log('   ⏯️ Toggled play/pause');
                await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 4000));
                await page.keyboard.press('Space');
            }
            
        } catch (error) {
            console.log('   ⚠️ Behavior simulation error:', error.message);
        }
    }
}

// Main execution
(async () => {
    try {
        const proxyManager = new ProxyManager();
        const userAgentManager = new UserAgentManager();
        const videoManager = new VideoManager();
        const githubUploader = new GitHubUploader();
        
        // Initialize all managers
        await proxyManager.initialize();
        await userAgentManager.initialize();
        await videoManager.initialize();

        // Find working proxies
        await proxyManager.findWorkingProxies();
        
        if (proxyManager.workingProxies.length === 0) {
            console.warn('⚠️ No working proxies found. Using direct connection');
        }

        // Run sessions continuously
        let sessionCount = 0;
        let successCount = 0;
        const MAX_SESSIONS = process.env.MAX_SESSIONS || 50;
        
        while (sessionCount < MAX_SESSIONS) {
            sessionCount++;
            let attempts = 0;
            let success = false;
            const maxAttempts = 3;
            
            while (attempts < maxAttempts && !success) {
                attempts++;
                success = await new SessionRunner(
                    proxyManager,
                    userAgentManager,
                    videoManager,
                    githubUploader
                ).runSession(sessionCount);
                
                if (!success) {
                    console.log(`   🔁 Retry attempt ${attempts}/${maxAttempts} for session #${sessionCount}`);
                    // Rotate proxy on failure
                    if (proxyManager.workingProxies.length > 1) {
                        proxyManager.workingProxies.shift(); // Remove failed proxy
                        console.log(`   🗑️ Removed top proxy from rotation`);
                    }
                }
            }
            
            if (success) successCount++;
            
            // Random delay between sessions
            const minDelay = parseInt(process.env.SESSION_DELAY_MIN || 60000);
            const maxDelay = parseInt(process.env.SESSION_DELAY_MAX || 180000);
            const delay = minDelay + Math.floor(Math.random() * (maxDelay - minDelay));
            console.log(`⏳ Next session in ${Math.round(delay/60000)} minutes...`);
            await setTimeout(delay);
        }
        
        console.log(`\n🎉 Finished ${sessionCount} sessions (${successCount} successful)`);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
})();
