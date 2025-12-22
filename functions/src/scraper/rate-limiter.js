import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load config
const configPath = join(__dirname, '../../config/scrape-config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

const { minDelayMs, maxDelayMs } = config.rateLimit;

/**
 * Random delay between min and max to appear more human-like
 */
export function getRandomDelay() {
    return Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
}

/**
 * Wait for a random amount of time
 */
export async function waitRandom() {
    const delay = getRandomDelay();
    console.log(`Waiting ${delay}ms before next request...`);
    await sleep(delay);
}

/**
 * Wait for a specific amount of time
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.error(`Attempt ${attempt}/${maxRetries} failed:`, error.message);

            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1);
                console.log(`Retrying in ${delay}ms...`);
                await sleep(delay);
            }
        }
    }

    throw lastError;
}
