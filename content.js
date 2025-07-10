// content.js - Script d'injection pour Google Meet
class GoogleMeetWidgetManager {
  constructor() {
      this.widgetEnabled = true;
      this.widgetIframe = null;
      this.widgetContainer = null;
      this.config = {
          position: 'bottom-right',
          maxBubbles: 5,
          autoHide: false
      };
      this.init();
  }

  async init() {
      console.log('Initialisation du gestionnaire de widget Google Meet...');
      // Attendre que la page soit complètement chargée
      if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => this.setup());
      } else {
          this.setup();
      }
  }

  async setup() {
      console.log('Initialisation du gestionnaire de widget Google Meet...');
      // Vérifier qu'on est bien sur Google Meet
      if (!window.location.href.includes('meet.google.com')) {
          return;
      }

      // Charger la configuration
      await this.loadConfig();

      // Créer le widget
      this.createWidget();

      // Écouter les messages de l'extension
      this.setupMessageListener();

      // Surveiller les changements de page
      this.setupPageChangeListener();

      console.log('Google Meet Widget Manager initialisé');
  }

  async loadConfig() {
      console.log('Chargement de la configuration du widget...');
      try {
          const response = await chrome.runtime.sendMessage({
              action: 'getPreferences',
              keys: ['widgetEnabled', 'widgetPosition', 'maxBubbles', 'autoHide']
          });

          if (response && response.success) {
              this.widgetEnabled = response.preferences.widgetEnabled !== false;
              this.config.position = response.preferences.widgetPosition || 'bottom-right';
              this.config.maxBubbles = response.preferences.maxBubbles || 5;
              this.config.autoHide = response.preferences.autoHide || false;
          }
      } catch (error) {
          console.error('Erreur lors du chargement de la configuration:', error);
      }
  }

  createWidget() {
      console.log('Création du widget Google Meet...');
      // Supprimer le widget existant s'il y en a un
      this.removeWidget();

      if (!this.widgetEnabled) {
          return;
      }

      // Créer le conteneur principal
      this.widgetContainer = document.createElement('div');
      this.widgetContainer.id = 'floating-bubbles-container';
      this.widgetContainer.style.cssText = `
          position: fixed;
          z-index: 1;
          pointer-events: auto;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
      `;

      // Créer l'iframe pour le widget
      this.widgetIframe = document.createElement('iframe');
      this.widgetIframe.id = 'floating-bubbles-widget';
      this.widgetIframe.src = chrome.runtime.getURL('widget.html');
      this.widgetIframe.style.cssText = `
          position: fixed;
          border: none;
          background: transparent;
          z-index: 1;
          pointer-events: auto;
          width: 400px;
          height: 600px;
      `;

      // Positionner selon la configuration
      this.updateWidgetPosition();

      // Ajouter l'iframe au conteneur
      this.widgetContainer.appendChild(this.widgetIframe);

      // Ajouter le conteneur au DOM
      document.body.appendChild(this.widgetContainer);

      // Configurer la communication avec l'iframe
      this.setupIframeMessaging();
  }

  updateWidgetPosition() {
      console.log('Mise à jour de la position du widget...');
      if (!this.widgetIframe) return;

      const positions = {
          'bottom-right': { bottom: '20px', right: '20px', top: 'auto', left: 'auto' },
          'bottom-left': { bottom: '20px', left: '20px', top: 'auto', right: 'auto' },
          'top-right': { top: '20px', right: '20px', bottom: 'auto', left: 'auto' },
          'top-left': { top: '20px', left: '20px', bottom: 'auto', right: 'auto' }
      };

      const position = positions[this.config.position] || positions['bottom-right'];
      
      Object.keys(position).forEach(key => {
          this.widgetIframe.style[key] = position[key];
      });
  }

  setupIframeMessaging() {
      console.log('Configuration de la communication avec l\'iframe du widget...');
      // Attendre que l'iframe soit chargée
      this.widgetIframe.onload = () => {
          // Envoyer la configuration au widget
          this.sendMessageToWidget('CONFIGURE', {
              config: this.config
          });

          // Permettre les interactions avec l'iframe
          this.widgetIframe.style.pointerEvents = 'auto';
      };

      // Écouter les messages du widget
      window.addEventListener('message', (event) => {
          if (event.source !== this.widgetIframe.contentWindow) return;

          switch (event.data.type) {
              case 'WIDGET_READY':
                  console.log('Widget prêt');
                  break;

              case 'WIDGET_INTERACTION':
                  this.handleWidgetInteraction(event.data.payload);
                  break;

              default:
                  console.log('Message du widget:', event.data);
          }
      });
  }

  sendMessageToWidget(type, payload = {}) {
      if (this.widgetIframe && this.widgetIframe.contentWindow) {
          this.widgetIframe.contentWindow.postMessage({
              type: type,
              ...payload
          }, '*');
      }
  }

  handleWidgetInteraction(payload) {
      // Logger les interactions pour le debugging
      chrome.runtime.sendMessage({
          action: 'logEvent',
          event: 'widget_interaction',
          data: payload
      });

      // Traiter les interactions spécifiques
      switch (payload.type) {
          case 'bubble_added':
              this.generateMeetNotification();
              break;
          case 'bubble_expanded':
              // Ajuster la position si nécessaire
              break;
      }
  }

  generateMeetNotification() {
      // Générer des notifications contextuelles basées sur Google Meet
      const meetNotifications = [
          {
              title: 'Participant rejoint',
              content: 'Un nouvel utilisateur a rejoint la réunion.',
              priority: 'medium',
              fullDescription: 'Un participant supplémentaire vient de rejoindre votre réunion Google Meet. Pensez à le saluer et à l\'informer du contexte actuel de la discussion.'
          },
          {
              title: 'Partage d\'écran actif',
              content: 'Un écran est actuellement partagé.',
              priority: 'high',
              fullDescription: 'Le partage d\'écran est en cours. Assurez-vous de bien voir le contenu partagé et n\'hésitez pas à poser des questions si nécessaire.'
          },
          {
              title: 'Enregistrement démarré',
              content: 'La réunion est maintenant enregistrée.',
              priority: 'high',
              fullDescription: 'L\'enregistrement de cette réunion Google Meet a été activé. Tous les participants en sont informés et le contenu sera sauvegardé.'
          },
          {
              title: 'Chat actif',
              content: 'Nouveaux messages dans le chat.',
              priority: 'low',
              fullDescription: 'De nouveaux messages ont été postés dans le chat de la réunion. Consultez le panneau de chat pour rester informé des discussions parallèles.'
          },
          {
              title: 'Qualité réseau',
              content: 'Connexion stable détectée.',
              priority: 'low',
              fullDescription: 'Votre connexion réseau est stable et de bonne qualité. La réunion devrait se dérouler sans interruption technique.'
          }
      ];

      const randomNotification = meetNotifications[Math.floor(Math.random() * meetNotifications.length)];
      
      const bubbleData = {
          ...randomNotification,
          id: Date.now(),
          timestamp: Date.now()
      };

      this.sendMessageToWidget('ADD_BUBBLE', { bubble: bubbleData });
  }

  setupMessageListener() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          switch (request.action) {
              case 'toggle':
                  this.toggleWidget();
                  sendResponse({ success: true, enabled: this.widgetEnabled });
                  break;

              case 'getStatus':
                  sendResponse({ 
                      success: true, 
                      enabled: this.widgetEnabled,
                      position: this.config.position
                  });
                  break;

              case 'updatePosition':
                  this.updatePosition(request.position);
                  sendResponse({ success: true });
                  break;

              case 'addBubble':
                  this.addBubble(request.bubble);
                  sendResponse({ success: true });
                  break;

              case 'configure':
                  this.configure(request.config);
                  sendResponse({ success: true });
                  break;

              default:
                  sendResponse({ success: false, error: 'Action non reconnue' });
          }
          return true;
      });
  }

  setupPageChangeListener() {
      // Surveiller les changements d'URL dans Google Meet
      let currentUrl = window.location.href;
      
      const observer = new MutationObserver(() => {
          if (window.location.href !== currentUrl) {
              currentUrl = window.location.href;
              
              // Réinitialiser le widget si nécessaire
              setTimeout(() => {
                  if (this.widgetEnabled && !this.widgetContainer) {
                      this.createWidget();
                  }
              }, 1000);
          }
      });

      observer.observe(document.body, {
          childList: true,
          subtree: true
      });
  }

  toggleWidget() {
      this.widgetEnabled = !this.widgetEnabled;
      
      if (this.widgetEnabled) {
          this.createWidget();
      } else {
          this.removeWidget();
      }

      // Sauvegarder la préférence
      chrome.runtime.sendMessage({
          action: 'savePreference',
          key: 'widgetEnabled',
          value: this.widgetEnabled
      });

      this.sendMessageToWidget('TOGGLE_VISIBILITY', { visible: this.widgetEnabled });
  }

  updatePosition(position) {
      console.log('Mise à jour de la position du widget vers:', position);
      this.config.position = position;
      this.updateWidgetPosition();
      this.sendMessageToWidget('UPDATE_POSITION', { position });

      // Sauvegarder la préférence
      chrome.runtime.sendMessage({
          action: 'savePreference',
          key: 'widgetPosition',
          value: position
      });
  }

  addBubble(bubbleData) {
      console.log('Ajout d\'une nouvelle bulle:', bubbleData);
      this.sendMessageToWidget('ADD_BUBBLE', { bubble: bubbleData });
  }

  configure(config) {
      this.config = { ...this.config, ...config };
      this.sendMessageToWidget('CONFIGURE', { config: this.config });
  }

  removeWidget() {
      if (this.widgetContainer) {
          this.widgetContainer.remove();
          this.widgetContainer = null;
          this.widgetIframe = null;
      }
  }
}

// Initialiser le gestionnaire
let googleMeetWidgetManager;

// Éviter les redéclarations
if (!googleMeetWidgetManager) {
  googleMeetWidgetManager = new GoogleMeetWidgetManager();
}

// Nettoyer lors du déchargement de la page
window.addEventListener('beforeunload', () => {
  if (googleMeetWidgetManager) {
      googleMeetWidgetManager.removeWidget();
  }
});