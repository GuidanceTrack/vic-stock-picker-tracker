import { readFileSync, existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SESSION_DIR = join(__dirname, '../../session');
const COOKIES_FILE = join(SESSION_DIR, 'cookies.json');
const STORAGE_FILE = join(SESSION_DIR, 'storage.json');

function checkSessionHealth() {
    console.log('\n' + '='.repeat(60));
    console.log('SESSION HEALTH CHECK');
    console.log('='.repeat(60) + '\n');

    // Check if session files exist
    if (!existsSync(COOKIES_FILE)) {
        console.log('❌ No session found - cookies.json does not exist');
        console.log(`   Expected location: ${COOKIES_FILE}\n`);
        return;
    }

    if (!existsSync(STORAGE_FILE)) {
        console.log('⚠️  Warning: storage.json not found');
        console.log(`   Expected location: ${STORAGE_FILE}\n`);
    }

    try {
        // Read cookies
        const cookies = JSON.parse(readFileSync(COOKIES_FILE, 'utf8'));
        const stats = statSync(COOKIES_FILE);

        const now = Date.now() / 1000; // Current time in seconds
        const sessionCreated = new Date(stats.mtime);
        const sessionAge = (Date.now() - stats.mtimeMs) / 1000; // in seconds

        console.log(`📁 Session File: ${COOKIES_FILE}`);
        console.log(`📅 Session Created: ${sessionCreated.toLocaleString()}`);
        console.log(`⏰ Session Age: ${(sessionAge / 86400).toFixed(2)} days (${(sessionAge / 3600).toFixed(1)} hours)\n`);

        console.log(`🍪 Total Cookies: ${cookies.length}\n`);

        // Find key cookies
        const vicSession = cookies.find(c => c.name === 'vic_session');
        const rememberToken = cookies.find(c => c.name.startsWith('remember_web_'));
        const cfClearance = cookies.find(c => c.name === 'cf_clearance');
        const cfBm = cookies.find(c => c.name === '__cf_bm');
        const cflb = cookies.find(c => c.name === '__cflb');

        console.log('Key Cookies Present:');
        console.log(`  • VIC Session (vic_session): ${vicSession ? '✓ Yes' : '✗ No'}`);
        console.log(`  • Remember Token (remember_web_*): ${rememberToken ? '✓ Yes' : '✗ No'}`);
        console.log(`  • Cloudflare Clearance (cf_clearance): ${cfClearance ? '✓ Yes' : '✗ No'}`);
        console.log(`  • Cloudflare Bot Management (__cf_bm): ${cfBm ? '✓ Yes' : '✗ No'}`);
        console.log(`  • Cloudflare Load Balancer (__cflb): ${cflb ? '✓ Yes' : '✗ No'}\n`);

        // Analyze cookie expirations
        const cookiesWithExpiry = cookies.filter(c => c.expires && c.expires > 0);

        if (cookiesWithExpiry.length === 0) {
            console.log('⚠️  No cookies have expiration timestamps set\n');
        } else {
            console.log('Cookie Expiration Details:\n');
            console.log(''.padEnd(30) + 'Expires At'.padEnd(30) + 'Time Remaining');
            console.log('-'.repeat(80));

            // Sort by expiration time (soonest first)
            const sortedCookies = cookiesWithExpiry
                .map(c => ({
                    name: c.name,
                    expires: c.expires,
                    expiresAt: new Date(c.expires * 1000),
                    expiresIn: c.expires - now
                }))
                .sort((a, b) => a.expires - b.expires);

            sortedCookies.forEach(cookie => {
                const nameDisplay = cookie.name.substring(0, 28).padEnd(30);
                const dateDisplay = cookie.expiresAt.toLocaleString().padEnd(30);

                let timeRemaining;
                let icon;
                if (cookie.expiresIn < 0) {
                    // Expired
                    const hoursAgo = Math.abs(cookie.expiresIn / 3600);
                    timeRemaining = `EXPIRED ${hoursAgo.toFixed(1)}h ago`;
                    icon = '❌';
                } else if (cookie.expiresIn < 3600) {
                    // Less than 1 hour
                    const minutes = cookie.expiresIn / 60;
                    timeRemaining = `⚠️  ${minutes.toFixed(0)} minutes`;
                    icon = '⚠️';
                } else if (cookie.expiresIn < 86400) {
                    // Less than 1 day
                    const hours = cookie.expiresIn / 3600;
                    timeRemaining = `${hours.toFixed(1)} hours`;
                    icon = '⚠️';
                } else {
                    // More than 1 day
                    const days = cookie.expiresIn / 86400;
                    timeRemaining = `${days.toFixed(2)} days`;
                    icon = '✓';
                }

                console.log(`${icon} ${nameDisplay}${dateDisplay}${timeRemaining}`);
            });

            // Summary
            console.log('\n' + '='.repeat(80));

            const firstExpiring = sortedCookies[0];
            if (firstExpiring.expiresIn < 0) {
                console.log(`\n❌ SESSION EXPIRED ${Math.abs(firstExpiring.expiresIn / 3600).toFixed(1)} hours ago`);
                console.log(`   First cookie expired: ${firstExpiring.name}`);
                console.log(`   You need to refresh your session by logging in again.\n`);
            } else if (firstExpiring.expiresIn < 3600) {
                console.log(`\n⚠️  SESSION EXPIRING SOON (in ${(firstExpiring.expiresIn / 60).toFixed(0)} minutes)`);
                console.log(`   Cookie about to expire: ${firstExpiring.name}\n`);
            } else if (firstExpiring.expiresIn < 86400) {
                console.log(`\n⚠️  SESSION EXPIRES IN ${(firstExpiring.expiresIn / 3600).toFixed(1)} HOURS`);
                console.log(`   First cookie to expire: ${firstExpiring.name}\n`);
            } else {
                console.log(`\n✓ SESSION VALID for ${(firstExpiring.expiresIn / 86400).toFixed(2)} days`);
                console.log(`  First cookie to expire: ${firstExpiring.name}`);
                console.log(`  Expiration date: ${firstExpiring.expiresAt.toLocaleString()}\n`);
            }
        }

        // Show cookies without expiry
        const cookiesWithoutExpiry = cookies.filter(c => !c.expires || c.expires <= 0);
        if (cookiesWithoutExpiry.length > 0) {
            console.log(`\nℹ️  ${cookiesWithoutExpiry.length} cookies have no expiration (session cookies):`);
            cookiesWithoutExpiry.forEach(c => {
                console.log(`   - ${c.name}`);
            });
            console.log('   These expire when the browser session ends.\n');
        }

    } catch (error) {
        console.error('❌ Error reading session:', error.message);
        console.error(error.stack);
    }

    console.log('='.repeat(60) + '\n');
}

// Run the check
checkSessionHealth();
