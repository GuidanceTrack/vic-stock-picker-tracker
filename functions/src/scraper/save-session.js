/**
 * Interactive session saver
 *
 * Run this script once to save your VIC login session:
 *   npm run save-session
 *
 * This will open a browser window where you can log in manually.
 * Once logged in, press Enter in the terminal to save the session.
 */

import { interactiveLogin } from './session-manager.js';

interactiveLogin()
    .then(() => {
        console.log('\nSession saved! You can now run the scraper.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Failed to save session:', error);
        process.exit(1);
    });
