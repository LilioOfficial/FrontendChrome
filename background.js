// background.js - Service Worker pour l'extension
class ExtensionBackground {
    constructor() {
      this.contextMenuCreated = false;
      this.init();
    }
  
    init() {
      // Gérer l'installation de l'extension
      chrome.runtime.onInstalled.addListener((details) => {
        this.handleInstall(details);
      });
  
      // Gérer les clics sur l'icône de l'extension
      chrome.action.onClicked.addListener((tab) => {
        this.handleIconClick(tab);
      });
  
      // Gérer les messages des content scripts
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        this.handleMessage(request, sender, sendResponse);
        return true; // Indique que la réponse sera asynchrone
      });
  
      // Gérer les changements d'onglets
      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        this.handleTabUpdate(tabId, changeInfo, tab);
      });

      // Configurer le menu contextuel
      this.setupContextMenu();
    }

    setupContextMenu() {
      if (this.contextMenuCreated) return;
      
      try {
        chrome.contextMenus.removeAll(() => {
          chrome.contextMenus.create({
            id: 'toggle-widget',
            title: 'Activer/Désactiver les bulles flottantes',
            contexts: ['page']
          });
          this.contextMenuCreated = true;
        });

        chrome.contextMenus.onClicked.addListener((info, tab) => {
          this.handleContextMenuClick(info, tab);
        });
      } catch (error) {
        console.error('Erreur lors de la configuration du menu contextuel:', error);
      }
    }

    async handleContextMenuClick(info, tab) {
      if (info.menuItemId === 'toggle-widget') {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
          if (response && response.success) {
            console.log('Widget basculé:', response.enabled);
          }
        } catch (error) {
          console.error('Erreur lors du basculement via le menu contextuel:', error);
        }
      }
    }
  
    handleInstall(details) {
      console.log('Extension installée:', details.reason);
      
      // Définir les paramètres par défaut
      chrome.storage.sync.set({
        widgetEnabled: true,
        widgetPosition: 'bottom-right',
        maxBubbles: 5,
        autoHide: false
      });
  
      // Ouvrir la page de bienvenue (optionnel)
      if (details.reason === 'install') {
        chrome.tabs.create({
          url: 'https://meet.google.com'
        });
      }
    }
  
    async handleIconClick(tab) {
      // Vérifier si on est sur Google Meet
      if (!tab.url || !tab.url.includes('meet.google.com')) {
        // Ouvrir Google Meet si on n'y est pas
        chrome.tabs.create({
          url: 'https://meet.google.com'
        });
        return;
      }
  
      try {
        // Basculer l'état du widget
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
        
        if (response && response.success) {
          console.log('Widget basculé:', response.enabled);
        }
      } catch (error) {
        console.error('Erreur lors du basculement:', error);
      }
    }
  
    async handleMessage(request, sender, sendResponse) {
      try {
        switch (request.action) {
          case 'getApiData':
            // Proxy pour les appels API externes
            const apiResponse = await this.fetchApiData(request.url, request.options);
            sendResponse({ success: true, data: apiResponse });
            break;
  
          case 'savePreference':
            // Sauvegarder les préférences
            await chrome.storage.sync.set({ [request.key]: request.value });
            sendResponse({ success: true });
            break;
  
          case 'getPreferences':
            // Récupérer les préférences
            const prefs = await chrome.storage.sync.get(request.keys);
            sendResponse({ success: true, preferences: prefs });
            break;
  
          case 'logEvent':
            // Logger les événements (pour le debugging)
            console.log('Widget Event:', request.event, request.data);
            sendResponse({ success: true });
            break;
  
          default:
            sendResponse({ success: false, error: 'Action non reconnue' });
        }
      } catch (error) {
        console.error('Erreur dans handleMessage:', error);
        sendResponse({ success: false, error: error.message });
      }
    }
  
    async fetchApiData(url, options = {}) {
      try {
        const response = await fetch(url, {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          },
          body: options.body ? JSON.stringify(options.body) : undefined
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Erreur API:', error);
        throw error;
      }
    }
  
    async handleTabUpdate(tabId, changeInfo, tab) {
      // Réagir aux changements d'URL
      if (changeInfo.status === 'complete' && tab.url) {
        const isGoogleMeet = tab.url.includes('meet.google.com');
        
        if (isGoogleMeet) {
          console.log('Page Google Meet détectée');
        }
      }
    }
  
    // Méthode pour nettoyer les données expirées
    async cleanupExpiredData() {
      try {
        const result = await chrome.storage.sync.get();
        const now = Date.now();
        const expirationTime = 24 * 60 * 60 * 1000; // 24 heures
  
        for (const [key, value] of Object.entries(result)) {
          if (value && value.timestamp && now - value.timestamp > expirationTime) {
            await chrome.storage.sync.remove(key);
          }
        }
      } catch (error) {
        console.error('Erreur lors du nettoyage:', error);
      }
    }
  }
  
  // Initialiser le service worker
  let extensionBackground;
  
  // Éviter les redéclarations
  if (!extensionBackground) {
    extensionBackground = new ExtensionBackground();
  }
  
  // Nettoyer les données expirées périodiquement
  chrome.alarms.create('cleanup', { periodInMinutes: 60 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanup') {
      extensionBackground.cleanupExpiredData();
    }
  });