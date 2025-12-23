import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load config
const configPath = join(__dirname, '../../config/scrape-config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

const SESSION_DIR = join(__dirname, '../../session');
const COOKIES_FILE = join(SESSION_DIR, 'cookies.json');
const STORAGE_FILE = join(SESSION_DIR, 'storage.json');

/**
 * Ensure session directory exists
 */
function ensureSessionDir() {
    if (!existsSync(SESSION_DIR)) {
        mkdirSync(SESSION_DIR, { recursive: true });
    }
}

/**
 * Check if we have a saved session
 */
export function hasStoredSession() {
    return existsSync(COOKIES_FILE) && existsSync(STORAGE_FILE);
}

/**
 * Save browser session (cookies + localStorage)
 */
export async function saveSession(context) {
    ensureSessionDir();

    // Save cookies
    const cookies = await context.cookies();
    writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));

    // Save storage state (includes localStorage)
    const storage = await context.storageState();
    writeFileSync(STORAGE_FILE, JSON.stringify(storage, null, 2));

    console.log('Session saved successfully');
}

/**
 * Load saved session into browser context
 */
export async function loadSession(context) {
    if (!hasStoredSession()) {
        console.log('No stored session found');
        return false;
    }

    try {
        // Load cookies
        const cookies = JSON.parse(readFileSync(COOKIES_FILE, 'utf8'));
        await context.addCookies(cookies);

        console.log('Session loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load session:', error.message);
        return false;
    }
}

/**
 * Create a new browser context with saved session
 */
export async function createAuthenticatedContext(browser) {
    let context;

    if (hasStoredSession()) {
        // Create context with stored state
        const storage = JSON.parse(readFileSync(STORAGE_FILE, 'utf8'));
        context = await browser.newContext({ storageState: storage });
        console.log('Created context with stored session');
    } else {
        context = await browser.newContext();
        console.log('Created fresh context (no stored session)');
    }

    return context;
}

/**
 * Session status constants
 */
export const SessionStatus = {
    LOGGED_IN: 'LOGGED_IN',
    EXPIRED: 'EXPIRED',
    CLOUDFLARE_BLOCKED: 'CLOUDFLARE_BLOCKED',
    UNKNOWN: 'UNKNOWN'
};

/**
 * Get detailed session health information
 */
export function getSessionHealth() {
    if (!hasStoredSession()) {
        return {
            status: 'NO_SESSION',
            hasSession: false,
            cookies: null,
            age: null,
            expiresIn: null
        };
    }

    try {
        const cookies = JSON.parse(readFileSync(COOKIES_FILE, 'utf8'));
        const storage = JSON.parse(readFileSync(STORAGE_FILE, 'utf8'));

        // Find key authentication cookies
        const vicSession = cookies.find(c => c.name === 'vic_session');
        const rememberToken = cookies.find(c => c.name.startsWith('remember_web_'));
        const cfClearance = cookies.find(c => c.name === 'cf_clearance' || c.name === '__cf_bm');

        // Calculate session age and expiration
        const now = Date.now() / 1000; // Convert to seconds

        let oldestExpiry = null;
        let cookieExpiries = [];

        for (const cookie of cookies) {
            if (cookie.expires && cookie.expires > 0) {
                cookieExpiries.push({
                    name: cookie.name,
                    expires: cookie.expires,
                    expiresIn: cookie.expires - now
                });

                if (!oldestExpiry || cookie.expires < oldestExpiry) {
                    oldestExpiry = cookie.expires;
                }
            }
        }

        // Determine session age (from file modification time)
        const stats = statSync(COOKIES_FILE);
        const sessionAge = (Date.now() - stats.mtimeMs) / 1000; // in seconds

        const expiresIn = oldestExpiry ? (oldestExpiry - now) : null;

        return {
            status: expiresIn && expiresIn < 0 ? 'EXPIRED' : 'VALID',
            hasSession: true,
            cookies: {
                total: cookies.length,
                vicSession: !!vicSession,
                rememberToken: !!rememberToken,
                cfClearance: !!cfClearance,
                expiries: cookieExpiries.sort((a, b) => a.expiresIn - b.expiresIn)
            },
            age: {
                seconds: sessionAge,
                hours: sessionAge / 3600,
                days: sessionAge / 86400
            },
            expiresIn: expiresIn ? {
                seconds: expiresIn,
                hours: expiresIn / 3600,
                days: expiresIn / 86400,
                timestamp: new Date(oldestExpiry * 1000).toISOString()
            } : null
        };
    } catch (error) {
        console.error('Error reading session health:', error.message);
        return {
            status: 'ERROR',
            hasSession: true,
            error: error.message
        };
    }
}

/**
 * Log session health to console
 */
export function logSessionHealth() {
    const health = getSessionHealth();

    console.log('\n=== Session Health ===');
    console.log(`Status: ${health.status}`);

    if (health.hasSession) {
        console.log(`Total Cookies: ${health.cookies?.total || 'N/A'}`);
        console.log(`VIC Session: ${health.cookies?.vicSession ? 'Yes' : 'No'}`);
        console.log(`Remember Token: ${health.cookies?.rememberToken ? 'Yes' : 'No'}`);
        console.log(`Cloudflare Clearance: ${health.cookies?.cfClearance ? 'Yes' : 'No'}`);

        if (health.age) {
            console.log(`Session Age: ${health.age.days.toFixed(2)} days (${health.age.hours.toFixed(1)} hours)`);
        }

        if (health.expiresIn) {
            if (health.expiresIn.seconds > 0) {
                console.log(`Expires In: ${health.expiresIn.days.toFixed(2)} days (${health.expiresIn.hours.toFixed(1)} hours)`);
                console.log(`Expiration Time: ${health.expiresIn.timestamp}`);
            } else {
                console.log(`⚠️  Session EXPIRED ${Math.abs(health.expiresIn.hours).toFixed(1)} hours ago`);
            }
        } else {
            console.log('Expiration: Unknown (no expiry timestamps found)');
        }

        if (health.cookies?.expiries && health.cookies.expiries.length > 0) {
            console.log('\nNext Expiring Cookies:');
            health.cookies.expiries.slice(0, 5).forEach(cookie => {
                const status = cookie.expiresIn > 0 ? `in ${(cookie.expiresIn / 3600).toFixed(1)}h` : `${Math.abs(cookie.expiresIn / 3600).toFixed(1)}h ago`;
                console.log(`  - ${cookie.name}: ${status}`);
            });
        }
    } else {
        console.log('No session found');
    }

    console.log('=====================\n');

    return health;
}

/**
 * Check if currently logged in by looking for auth indicators
 * Returns detailed status instead of just boolean
 */
export async function isLoggedIn(page) {
    try {
        // Navigate to a page that requires auth
        await page.goto(config.urls.base, { waitUntil: 'networkidle', timeout: 30000 });

        // Check for Cloudflare challenge page
        const pageContent = await page.content();
        const isCloudflare = pageContent.includes('Checking your browser') ||
                            pageContent.includes('cloudflare') ||
                            await page.$('#challenge-running, .cf-browser-verification');

        if (isCloudflare) {
            console.log('⚠️  Cloudflare challenge detected');
            return SessionStatus.CLOUDFLARE_BLOCKED;
        }

        // Check for login indicators - adjust these selectors based on actual VIC site
        const logoutButton = await page.$('a[href*="logout"], .logout, button:has-text("Log out")');
        const loginButton = await page.$('a[href*="login"], .login, button:has-text("Log in")');

        if (logoutButton) {
            console.log('✓ Session is valid - user is logged in');
            return SessionStatus.LOGGED_IN;
        }

        if (loginButton) {
            console.log('✗ Session expired - login button visible');
            return SessionStatus.EXPIRED;
        }

        // Fallback: check for member-only content
        const memberContent = await page.$('.member-content, .ideas-list, [data-member]');
        if (memberContent) {
            console.log('✓ Session appears valid - member content visible');
            return SessionStatus.LOGGED_IN;
        }

        console.log('? Could not determine login status');
        return SessionStatus.UNKNOWN;

    } catch (error) {
        console.error('Error checking login status:', error.message);

        // Check if it's a timeout or navigation error (might indicate Cloudflare)
        if (error.message.includes('timeout') || error.message.includes('net::ERR')) {
            return SessionStatus.CLOUDFLARE_BLOCKED;
        }

        return SessionStatus.UNKNOWN;
    }
}

/**
 * Check if currently logged in (backwards compatible boolean version)
 */
export async function checkLoginStatus(page) {
    const status = await isLoggedIn(page);
    return status === SessionStatus.LOGGED_IN;
}

/**
 * Perform login with credentials
 */
export async function performLogin(page, email, password) {
    console.log('Attempting login...');

    await page.goto(config.urls.login, { waitUntil: 'networkidle' });

    const selectors = config.selectors.login;

    // Fill email
    await page.fill(selectors.emailInput, email);

    // Fill password
    await page.fill(selectors.passwordInput, password);

    // Click submit
    await page.click(selectors.submitButton);

    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'networkidle' });

    // Verify login succeeded
    const success = await isLoggedIn(page);

    if (success) {
        console.log('Login successful!');
    } else {
        throw new Error('Login failed - could not verify logged in state');
    }

    return success;
}

/**
 * Interactive session saver - opens browser for manual login
 * Run this once to save your session: npm run save-session
 */
export async function interactiveLogin() {
    console.log('Opening browser for manual login...');
    console.log('Please log in to VIC, then press Enter in this terminal when done.');

    const browser = await chromium.launch({
        headless: false,  // Show the browser
        slowMo: 100
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(config.urls.login);

    // Wait for user to login manually
    console.log('\n>>> Log in to VIC in the browser window <<<');
    console.log('>>> Then press Enter here when done <<<\n');

    await waitForEnter();

    // Save the session
    await saveSession(context);

    await browser.close();
    console.log('Browser closed. Session saved!');
}

function waitForEnter() {
    return new Promise(resolve => {
        process.stdin.once('data', () => {
            resolve();
        });
    });
}
