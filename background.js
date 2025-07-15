// background.js - Service Worker pour l'extension Floating Bubbles - Version synchronisée
class FloatingBubblesBackgroundManager {
  constructor() {
      this.preferences = {
          widgetEnabled: true,
          widgetPosition: 'bottom-left', // Position par défaut selon les spécifications
          maxBubbles: 5,
          autoHide: false,
          animationDuration: 2000, // Durée d'animation de chargement
          notificationFrequency: 30000 // Fréquence des notifications auto (30s)
      };
      this.activeTabId = null;
      this.init();
  }

  init() {
      console.log('Initialisation du Background Manager...');
      
      // Charger les préférences sauvegardées
      this.loadPreferences();
      
      // Configurer les écouteurs d'événements
      this.setupEventListeners();
      
      // Configurer les alarmes pour les notifications automatiques
      this.setupAlarms();
      
      // Configurer le menu contextuel
      this.setupContextMenu();

        // Configurer le WebSocket pour les notifications en temps réel
      this.setupWebSocket();
      
      console.log('Background Manager initialisé');
  }

  async loadPreferences() {
      try {
          const result = await chrome.storage.sync.get(Object.keys(this.preferences));
          this.preferences = { ...this.preferences, ...result };
          console.log('Préférences chargées:', this.preferences);
      } catch (error) {
          console.error('Erreur lors du chargement des préférences:', error);
      }
  }

  async savePreference(key, value) {
      try {
          this.preferences[key] = value;
          await chrome.storage.sync.set({ [key]: value });
          console.log(`Préférence sauvegardée: ${key} = ${value}`);
          return true;
      } catch (error) {
          console.error('Erreur lors de la sauvegarde:', error);
          return false;
      }
  }

  setupWebSocket() {
    const wsUrl = 'wss://dev.lili-o.com/ws/frontend?name=api.chat'; // Remplacer par votre URL WebSocket
    this.socket = new WebSocket(wsUrl);
    console.log('Configuration du WebSocket:', wsUrl);
    this.socket.onopen = () => {
      console.log('WebSocket connecté');
      this.socket.send(JSON.stringify({ event: 'subscribe', channel: 'notifications' }));
    };

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Données reçues via WebSocket:', data);
      this.addBubbleToTab(this.activeTabId, data); // Utiliser BublleData pour formater les données
    };

    this.socket.onerror = (error) => {
      console.error('Erreur WebSocket:', error);
    };

    this.socket.onclose = () => {
      console.log('WebSocket fermé, tentative de reconnexion dans 5 secondes');
      setTimeout(() => this.setupWebSocket(), 5000);
    };
  }


  setupEventListeners() {
      // Écouter les messages des content scripts et popup
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          this.handleMessage(request, sender, sendResponse);
          return true; // Maintenir la connexion pour les réponses asynchrones
      });

      // Écouter les changements d'onglet
      chrome.tabs.onActivated.addListener((activeInfo) => {
          this.activeTabId = activeInfo.tabId;
          this.checkAndInjectIntoTab(activeInfo.tabId);
      });

      // Écouter les mises à jour d'URL
      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
          if (changeInfo.status === 'complete' && tab.url && tab.url.includes('meet.google.com')) {
              this.checkAndInjectIntoTab(tabId);
          }
      });

      // Écouter l'installation/mise à jour de l'extension
      chrome.runtime.onInstalled.addListener((details) => {
          this.handleInstall(details);
      });
  }

  setupAlarms() {
      // Configurer une alarme pour les notifications automatiques
      chrome.alarms.onAlarm.addListener((alarm) => {
          if (alarm.name === 'autoNotification') {
              this.triggerAutoNotification();
          }
      });

      // Créer l'alarme récurrente si les notifications auto sont activées
      if (this.preferences.autoHide) {
          chrome.alarms.create('autoNotification', {
              delayInMinutes: this.preferences.notificationFrequency / 60000,
              periodInMinutes: this.preferences.notificationFrequency / 60000
          });
      }
  }

  setupContextMenu() {
      // Créer le menu contextuel
      chrome.contextMenus.removeAll(() => {
          chrome.contextMenus.create({
              id: 'toggleWidget',
              title: 'Activer/Désactiver les bulles flottantes',
              contexts: ['page'],
              documentUrlPatterns: ['https://meet.google.com/*']
          });

          chrome.contextMenus.create({
              id: 'addBubble',
              title: 'Ajouter une bulle de notification',
              contexts: ['page'],
              documentUrlPatterns: ['https://meet.google.com/*']
          });

          chrome.contextMenus.create({
              id: 'separator',
              type: 'separator',
              contexts: ['page'],
              documentUrlPatterns: ['https://meet.google.com/*']
          });

          chrome.contextMenus.create({
              id: 'positionBottomLeft',
              title: 'Position: Bas gauche',
              type: 'radio',
              checked: this.preferences.widgetPosition === 'bottom-left',
              contexts: ['page'],
              documentUrlPatterns: ['https://meet.google.com/*']
          });

          chrome.contextMenus.create({
              id: 'positionTopLeft',
              title: 'Position: Haut gauche',
              type: 'radio',
              checked: this.preferences.widgetPosition === 'top-left',
              contexts: ['page'],
              documentUrlPatterns: ['https://meet.google.com/*']
          });
      });

      // Écouter les clics sur le menu contextuel
      chrome.contextMenus.onClicked.addListener((info, tab) => {
          this.handleContextMenuClick(info, tab);
      });
  }

  async handleMessage(request, sender, sendResponse) {
      try {
          switch (request.action) {
              case 'getPreferences':
                  sendResponse({
                      success: true,
                      preferences: this.getRequestedPreferences(request.keys)
                  });
                  break;

              case 'savePreference':
                  const saved = await this.savePreference(request.key, request.value);
                  sendResponse({ success: saved });
                  break;

              case 'toggleWidget':
                  await this.toggleWidget(sender.tab.id);
                  sendResponse({ success: true });
                  break;

              case 'addBubble':
                  await this.addBubbleToTab(sender.tab.id, request.bubble);
                  sendResponse({ success: true });
                  break;

              case 'logEvent':
                  this.logEvent(request.event, request.data);
                  sendResponse({ success: true });
                  break;

              case 'checkMeetPage':
                  const isMeetPage = await this.checkIfMeetPage(sender.tab.id);
                  sendResponse({ success: true, isMeetPage });
                  break;

              case 'injectWidget':
                  await this.injectWidgetIntoTab(sender.tab.id);
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

  getRequestedPreferences(keys) {
      if (!keys || keys.length === 0) {
          return this.preferences;
      }
      
      const result = {};
      keys.forEach(key => {
          if (this.preferences.hasOwnProperty(key)) {
              result[key] = this.preferences[key];
          }
      });
      return result;
  }

  async checkAndInjectIntoTab(tabId) {
      try {
          const tab = await chrome.tabs.get(tabId);
          if (tab.url && tab.url.includes('meet.google.com')) {
              // Attendre un peu pour s'assurer que la page est bien chargée
              setTimeout(() => {
                  this.injectWidgetIntoTab(tabId);
              }, 2000);
          }
      } catch (error) {
          console.error('Erreur lors de la vérification de l\'onglet:', error);
      }
  }

  async injectWidgetIntoTab(tabId) {
      try {
          // Vérifier si le content script est déjà injecté
          const results = await chrome.scripting.executeScript({
              target: { tabId: tabId },
              func: () => {
                  return typeof window.googleMeetWidgetManager !== 'undefined';
              }
          });

          if (results && results[0] && results[0].result) {
              console.log('Content script déjà injecté dans l\'onglet', tabId);
              return;
          }

          // Injecter le content script si nécessaire
          await chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['content.js']
          });

          await chrome.scripting.insertCSS({
              target: { tabId: tabId },
              files: ['content.css']
          });

          console.log('Widget injecté dans l\'onglet', tabId);
      } catch (error) {
          console.error('Erreur lors de l\'injection du widget:', error);
      }
  }

  async toggleWidget(tabId) {
      try {
          const response = await chrome.tabs.sendMessage(tabId, { action: 'toggle' });
          
          if (response && response.success) {
              this.preferences.widgetEnabled = response.enabled;
              await this.savePreference('widgetEnabled', response.enabled);
              console.log('Widget basculé:', response.enabled ? 'activé' : 'désactivé');
          }
      } catch (error) {
          console.error('Erreur lors du basculement du widget:', error);
      }
  }

  async addBubbleToTab(tabId, bubbleData) {
      try {
          const bubble = bubbleData || this.generateSampleBubble();
          this.socket.send(
                JSON.stringify({"action" : "clickButton"})
          )
          await chrome.tabs.sendMessage(tabId, { 
              action: 'addBubble', 
              bubble: bubble 
          });
          console.log('Bulle ajoutée à l\'onglet', tabId);
      } catch (error) {
          console.error('Erreur lors de l\'ajout de bulle:', error);
      }
  }

  generateSampleBubble() {
      const sampleBubbles = [
          {
              title: 'Nouveau participant',
              content: 'Un utilisateur a rejoint la réunion',
              priority: 'medium',
              fullDescription: 'Un nouveau participant vient de rejoindre votre réunion Google Meet.'
          },
          {
              title: 'Partage d\'écran',
              content: 'Partage d\'écran activé',
              priority: 'high',
              fullDescription: 'Le partage d\'écran est maintenant actif.'
          },
          {
              title: 'Chat actif',
              content: 'Nouveaux messages disponibles',
              priority: 'low',
              fullDescription: 'De nouveaux messages ont été postés dans le chat.'
          },
          {
              title: 'Qualité réseau',
              content: 'Connexion stable',
              priority: 'low',
              fullDescription: 'Votre connexion réseau est stable.'
          }
      ];

      const randomBubble = sampleBubbles[Math.floor(Math.random() * sampleBubbles.length)];
      return {
          ...randomBubble,
          id: Date.now() + Math.random(),
          timestamp: Date.now()
      };
  }

  async handleContextMenuClick(info, tab) {
      switch (info.menuItemId) {
          case 'toggleWidget':
              await this.toggleWidget(tab.id);
              break;

          case 'addBubble':
              await this.addBubbleToTab(tab.id);
              break;

          case 'positionBottomLeft':
              await this.updateWidgetPosition(tab.id, 'bottom-left');
              break;

          case 'positionTopLeft':
              await this.updateWidgetPosition(tab.id, 'top-left');
              break;
      }
  }

  async updateWidgetPosition(tabId, position) {
      try {
          await chrome.tabs.sendMessage(tabId, { 
              action: 'updatePosition', 
              position: position 
          });
          await this.savePreference('widgetPosition', position);
          console.log('Position du widget mise à jour:', position);
      } catch (error) {
          console.error('Erreur lors de la mise à jour de position:', error);
      }
  }

  async triggerAutoNotification() {
      try {
          const tabs = await chrome.tabs.query({
              url: 'https://meet.google.com/*'
          });

          for (const tab of tabs) {
              if (this.preferences.widgetEnabled) {
                  await this.addBubbleToTab(tab.id);
              }
          }
      } catch (error) {
          console.error('Erreur lors de la notification automatique:', error);
      }
  }

  async checkIfMeetPage(tabId) {
      try {
          const tab = await chrome.tabs.get(tabId);
          return tab.url && tab.url.includes('meet.google.com');
      } catch (error) {
          console.error('Erreur lors de la vérification de la page Meet:', error);
          return false;
      }
  }

  logEvent(event, data) {
      console.log(`Event: ${event}`, data);
      // Ici on pourrait ajouter de la télémétrie ou des analytics
  }

  async handleInstall(details) {
      console.log('Extension installée/mise à jour:', details.reason);
      
      if (details.reason === 'install') {
          // Première installation
          console.log('Première installation de l\'extension');
          
          // Ouvrir la page de configuration ou d'aide
          try {
              await chrome.tabs.create({
                  url: chrome.runtime.getURL('welcome.html')
              });
          } catch (error) {
              console.log('Page de bienvenue non disponible');
          }
      } else if (details.reason === 'update') {
          // Mise à jour
          console.log('Extension mise à jour vers la version', chrome.runtime.getManifest().version);
      }
  }
}

// Initialiser le gestionnaire
const backgroundManager = new FloatingBubblesBackgroundManager();

// Exposer globalement pour le debugging
globalThis.backgroundManager = backgroundManager;