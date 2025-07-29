let isScraping = false;
let scrapingTimeout = null;
const scrapedPostIds = new Set();

function startScraping() {
    if (isScraping) return;
    isScraping = true;
    console.log("Scraper: Starting...");
    chrome.runtime.sendMessage({ action: 'scrapingUpdate', isScraping: true });
    scrapeAndScroll();
}

function stopScraping() {
    if (!isScraping) return;
    isScraping = false;
    clearTimeout(scrapingTimeout);
    console.log("Scraper: Stopped.");
    chrome.runtime.sendMessage({ action: 'scrapingUpdate', isScraping: false });
}

function scrapeAndScroll() {
    if (!isScraping) return;

    console.log("Scraper: Running scrape cycle...");
    const articles = document.querySelectorAll('article');
    console.log(`Scraper: Found ${articles.length} <article> elements.`);

    if (articles.length === 0) {
        chrome.runtime.sendMessage({
            action: 'error',
            message: 'No posts found. Please ensure you are logged in and on the Instagram feed.'
        });
        stopScraping();
        return;
    }

    for (const article of articles) {
        try {
            // Find post link for unique ID
            const postLink = article.querySelector('a[href*="/p/"]');
            const postId = postLink ? postLink.href : null;
            if (!postId || scrapedPostIds.has(postId)) continue;

            // Find username (updated selector: try header link or span with user info)
            let usernameElement = article.querySelector('header a[href*="/"]');
            if (!usernameElement) usernameElement = article.querySelector('header span[title]');
            const username = usernameElement ? usernameElement.textContent.trim() : 'Unknown';

            // Find caption (updated selector: try multiple common locations)
            let captionElement = article.querySelector('div[role="dialog"] span:not(:empty)');
            if (!captionElement) captionElement = article.querySelector('div[role="article"] div[role="textbox"]');
            if (!captionElement) captionElement = article.querySelector('div[class*="Caption"] span');
            const caption = captionElement ? captionElement.textContent.trim() : '';

            if (!caption) {
                console.log(`Scraper: Skipping post ${postId} - no caption found. Elements checked:`, {
                    usernameElement: usernameElement ? usernameElement.outerHTML : 'Not found',
                    captionElement: captionElement ? captionElement.outerHTML : 'Not found'
                });
                continue;
            }

            console.log(`Scraper: Found post ${postId} by ${username}: "${caption}"`);
            chrome.runtime.sendMessage({
                action: 'newPost',
                data: {
                    id: postId,
                    username: username,
                    caption: caption
                }
            });
            scrapedPostIds.add(postId);
        } catch (e) {
            console.error("Scraper: Error processing article:", e);
        }
    }

    window.scrollBy(0, window.innerHeight);
    const randomDelay = Math.floor(Math.random() * (6000 - 4000 + 1)) + 4000;
    scrapingTimeout = setTimeout(scrapeAndScroll, randomDelay);
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'startScraping') {
        startScraping();
    } else if (message.action === 'stopScraping') {
        stopScraping();
    }
    return true;
});