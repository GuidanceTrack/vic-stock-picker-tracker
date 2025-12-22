import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
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
 * Check if currently logged in by looking for auth indicators
 */
export async function isLoggedIn(page) {
    try {
        // Navigate to a page that requires auth
        await page.goto(config.urls.base, { waitUntil: 'networkidle' });

        // Check for login indicators - adjust these selectors based on actual VIC site
        const logoutButton = await page.$('a[href*="logout"], .logout, button:has-text("Log out")');
        const loginButton = await page.$('a[href*="login"], .login, button:has-text("Log in")');

        if (logoutButton) {
            console.log('Session is valid - user is logged in');
            return true;
        }

        if (loginButton) {
            console.log('Session expired - login button visible');
            return false;
        }

        // Fallback: check for member-only content
        const memberContent = await page.$('.member-content, .ideas-list, [data-member]');
        return !!memberContent;

    } catch (error) {
        console.error('Error checking login status:', error.message);
        return false;
    }
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
