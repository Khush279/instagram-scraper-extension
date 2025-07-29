const popupScript = {
    elements: {
        startButton: null,
        stopButton: null,
        clearButton: null,
        statusDiv: null,
        statusText: null,
        searchInput: null,
        resultsBody: null,
        postCount: null
    },
    state: {
        isScraping: false,
        scrapedData: []
    },

    init: function() {
        this.elements.startButton = document.getElementById('startButton');
        this.elements.stopButton = document.getElementById('stopButton');
        this.elements.clearButton = document.getElementById('clearButton');
        this.elements.statusDiv = document.getElementById('status');
        this.elements.statusText = document.getElementById('statusText');
        this.elements.searchInput = document.getElementById('searchInput');
        this.elements.resultsBody = document.getElementById('results');
        this.elements.postCount = document.getElementById('postCount');

        this.elements.startButton.addEventListener('click', () => this.startScraping());
        this.elements.stopButton.addEventListener('click', () => this.stopScraping());
        this.elements.clearButton.addEventListener('click', () => this.clearData());
        this.elements.searchInput.addEventListener('input', (e) => this.filterData(e.target.value));

        chrome.runtime.onMessage.addListener((message) => this.handleMessage(message));
        this.loadData();
    },

    handleMessage: function(message) {
        if (message.action === 'newPost') {
            if (!this.state.scrapedData.some(p => p.id === message.data.id)) {
                this.state.scrapedData.unshift(message.data);
                this.saveData();
                this.filterData(this.elements.searchInput.value);
            }
        } else if (message.action === 'scrapingUpdate') {
            this.state.isScraping = message.isScraping;
            this.updateUI();
        } else if (message.action === 'error') {
            this.state.isScraping = false;
            this.elements.statusText.textContent = message.message;
            this.elements.statusDiv.classList.remove('hidden');
            this.updateUI();
            setTimeout(() => {
                this.elements.statusDiv.classList.add('hidden');
            }, 3000);
        }
    },

    startScraping: function() {
        this.state.isScraping = true;
        this.updateUI();
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url.includes("instagram.com")) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ['content.js']
                }).then(() => {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'startScraping' });
                }).catch(err => {
                    console.error("Scraper: Failed to inject content script.", err);
                    this.elements.statusText.textContent = "Error: Could not start scraper.";
                    this.elements.statusDiv.classList.remove('hidden');
                    this.state.isScraping = false;
                    this.updateUI();
                    setTimeout(() => {
                        this.elements.statusDiv.classList.add('hidden');
                    }, 3000);
                });
            } else {
                this.elements.statusText.textContent = "Please navigate to Instagram and log in.";
                this.elements.statusDiv.classList.remove('hidden');
                this.state.isScraping = false;
                this.updateUI();
                setTimeout(() => {
                    this.elements.statusDiv.classList.add('hidden');
                }, 3000);
            }
        });
    },

    stopScraping: function() {
        this.state.isScraping = false;
        this.updateUI();
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'stopScraping' });
            }
        });
    },

    loadData: function() {
        chrome.storage.local.get(['scrapedPosts', 'isScraping'], (result) => {
            this.state.scrapedData = result.scrapedPosts || [];
            this.state.isScraping = result.isScraping || false;
            this.renderData();
            this.updateUI();
        });
    },

    saveData: function() {
        chrome.storage.local.set({ scrapedPosts: this.state.scrapedData });
    },

    clearData: function() {
        if (window.confirm("Clear all scraped data?")) {
            this.state.scrapedData = [];
            chrome.storage.local.clear(() => {
                this.renderData();
            });
        }
    },

    filterData: function(searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const filtered = this.state.scrapedData.filter(item =>
            item.caption.toLowerCase().includes(lowerCaseSearchTerm)
        );
        this.renderData(filtered);
    },

    updateUI: function() {
        this.elements.startButton.disabled = this.state.isScraping;
        this.elements.stopButton.disabled = !this.state.isScraping;
        this.elements.statusDiv.classList.toggle('hidden', !this.state.isScraping);
        if (this.state.isScraping) {
            this.elements.statusText.textContent = "Scraping in progress...";
        }
        chrome.storage.local.set({ isScraping: this.state.isScraping });
    },

    renderData: function(dataToRender = this.state.scrapedData) {
        this.elements.resultsBody.innerHTML = '';
        if (dataToRender.length === 0) {
            this.elements.resultsBody.innerHTML = '<tr><td colspan="2" class="text-center py-6 text-gray-500">No posts found.</td></tr>';
        } else {
            dataToRender.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="px-4 py-3 text-sm text-gray-800">${item.username}</td>
                    <td class="px-4 py-3 text-sm text-gray-800">${item.caption.substring(0, 100)}${item.caption.length > 100 ? '...' : ''}</td>
                `;
                this.elements.resultsBody.appendChild(row);
            });
        }
        this.elements.postCount.textContent = `Found ${this.state.scrapedData.length} posts${dataToRender.length !== this.state.scrapedData.length ? ` (Showing ${dataToRender.length})` : ''}.`;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    popupScript.init();
});