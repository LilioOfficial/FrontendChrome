// content.js - Script d'injection pour Google Meet - Version synchronisée
class GoogleMeetWidgetManager {
    constructor() {
        this.widgetEnabled = true;
        this.widgetIframe = null;
        this.widgetContainer = null;
        this.meetButtonReference = null;
        this.config = {
            position: 'bottom-left', // Changé pour bottom-left selon les spécifications
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
        console.log('Setup du gestionnaire de widget Google Meet...');
        // Vérifier qu'on est bien sur Google Meet
        if (!window.location.href.includes('meet.google.com')) {
            return;
        }
  
        // Attendre que l'interface Google Meet soit chargée
        await this.waitForMeetInterface();
  
        // Charger la configuration
        await this.loadConfig();
  
        // Localiser le bouton "+" de Google Meet
        this.locateMeetButton();
  
        // Créer le widget
        this.createWidget();
  
        // Écouter les messages de l'extension
        this.setupMessageListener();
  
        // Surveiller les changements de page
        this.setupPageChangeListener();
  
        console.log('Google Meet Widget Manager initialisé');
    }
  
    async waitForMeetInterface() {
        console.log('Attente du chargement de l\'interface Google Meet...');
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                // Chercher des éléments caractéristiques de Google Meet
                const meetElements = document.querySelectorAll('[data-call-status], [data-call-controls], [role="button"]');
                if (meetElements.length > 0) {
                    clearInterval(checkInterval);
                    setTimeout(resolve, 1000); // Attendre 1 seconde supplémentaire
                }
            }, 500);
            
            // Timeout après 10 secondes
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 10000);
        });
    }
  
    locateMeetButton() {
        console.log('Localisation du bouton "+" de Google Meet...');
        
        // Sélecteurs possibles pour le bouton "+" de Google Meet
        const buttonSelectors = [
            '[aria-label="+"]',
            '[aria-label="Plus d\'options"]',
            '[aria-label="More options"]',
            '[aria-label="Afficher plus d\'options"]',
            '[data-tooltip="Plus d\'options"]',
            'button[aria-label*="+"]',
            'button[aria-label*="Plus"]',
            'button[aria-label*="More"]'
        ];
  
        // Chercher le bouton dans l'ordre de priorité
        for (const selector of buttonSelectors) {
            const button = document.querySelector(selector);
            if (button) {
                this.meetButtonReference = button;
                console.log('✅ Bouton Google Meet trouvé:', selector);
                break;
            }
        }
  
        // Si aucun bouton spécifique n'est trouvé, utiliser une approche générique
        if (!this.meetButtonReference) {
            console.log('🔍 Recherche générique du bouton Google Meet...');
            const allButtons = document.querySelectorAll('button');
            for (const button of allButtons) {
                const text = button.textContent || button.getAttribute('aria-label') || '';
                if (text.includes('+') || text.includes('Plus') || text.includes('More')) {
                    this.meetButtonReference = button;
                    console.log('✅ Bouton Google Meet trouvé via recherche générique');
                    break;
                }
            }
        }
  
        if (!this.meetButtonReference) {
            console.warn('❌ Bouton Google Meet non trouvé, positionnement par défaut');
        }
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
                this.config.position = response.preferences.widgetPosition || 'bottom-left';
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
            z-index: 10001;
            pointer-events: none;
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
            z-index: 10001;
            pointer-events: auto;
            width: 400px;
            height: 600px;
        `;
  
        // Positionner selon les spécifications (bottom-left, au-dessus du bouton "+")
        this.updateWidgetPosition();
  
        // Ajouter l'iframe au conteneur
        this.widgetContainer.appendChild(this.widgetIframe);
  
        // Ajouter le conteneur au DOM
        document.body.appendChild(this.widgetContainer);
  
        // Configurer la communication avec l'iframe
        this.setupIframeMessaging();
    }
  
    updateWidgetPosition() {
        console.log('Positionnement du widget au-dessus du bouton Google Meet...');
        if (!this.widgetIframe) return;
  
        let bottom = '80px'; // Position par défaut au-dessus du bouton "+"
        let left = '20px';   // Position par défaut à gauche
  
        // Si le bouton Google Meet est trouvé, calculer la position relative
        if (this.meetButtonReference) {
            const buttonRect = this.meetButtonReference.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            
            // Calculer la position bottom basée sur la position du bouton
            const buttonBottomFromWindowBottom = windowHeight - buttonRect.bottom;
            bottom = `${buttonBottomFromWindowBottom + 20}px`; // 20px d'espacement
            
            // Utiliser la même position horizontale que le bouton
            left = `${buttonRect.left}px`;
            
            console.log(`Position calculée: bottom=${bottom}, left=${left}`);
        }
  
        // Appliquer le positionnement
        this.widgetIframe.style.bottom = bottom;
        this.widgetIframe.style.left = left;
        this.widgetIframe.style.top = 'auto';
        this.widgetIframe.style.right = 'auto';
    }
  
    setupIframeMessaging() {
        console.log('Configuration de la communication avec l\'iframe du widget...');
        // Attendre que l'iframe soit chargée
        this.widgetIframe.onload = () => {
            console.log('IFrame du widget chargée');
            
            // Envoyer la configuration au widget
            this.sendMessageToWidget('CONFIGURE', {
                config: this.config
            });
  
            // Permettre les interactions avec l'iframe
            this.widgetIframe.style.pointerEvents = 'auto';
            
            // Ajouter une bulle de démonstration après 2 secondes
            setTimeout(() => {
                this.generateMeetNotification();
            }, 2000);
        };
  
        // Écouter les messages du widget
        window.addEventListener('message', (event) => {
            if (event.source !== this.widgetIframe.contentWindow) return;
  
            switch (event.data.type) {
                case 'WIDGET_READY':
                    console.log('✅ Widget prêt et opérationnel');
                    this.onWidgetReady();
                    break;
  
                case 'WIDGET_INTERACTION':
                    this.handleWidgetInteraction(event.data.payload);
                    break;
  
                default:
                    console.log('Message du widget:', event.data);
            }
        });
    }
  
    onWidgetReady() {
        // Repositionner le widget après qu'il soit prêt
        this.updateWidgetPosition();
        
        // Surveiller les changements de taille de fenêtre
        window.addEventListener('resize', () => {
            this.updateWidgetPosition();
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
                this.updateWidgetPosition();
                break;
        }
    }
  
    generateMeetNotification() {
        // Générer des notifications contextuelles basées sur Google Meet
        const meetNotifications = [
            {
                title: 'Nouveau participant',
                content: 'Un utilisateur a rejoint la réunion',
                priority: 'medium',
                fullDescription: 'Un nouveau participant vient de rejoindre votre réunion Google Meet. Pensez à le saluer et à l\'informer du contexte actuel.'
            },
            {
                title: 'Partage d\'écran',
                content: 'Partage d\'écran activé',
                priority: 'high',
                fullDescription: 'Le partage d\'écran est maintenant actif. Assurez-vous de bien voir le contenu partagé.'
            },
            {
                title: 'Chat actif',
                content: 'Nouveaux messages disponibles',
                priority: 'low',
                fullDescription: 'De nouveaux messages ont été postés dans le chat de la réunion. Consultez le panneau pour rester informé.'
            },
            {
                title: 'Enregistrement démarré',
                content: 'La réunion est maintenant enregistrée',
                priority: 'high',
                fullDescription: 'L\'enregistrement de cette réunion Google Meet a été activé. Tous les participants en sont informés.'
            },
            {
                title: 'Qualité réseau',
                content: 'Connexion stable',
                priority: 'low',
                fullDescription: 'Votre connexion réseau est stable. La réunion devrait se dérouler sans problème.'
            }
        ];
  
        const randomNotification = meetNotifications[Math.floor(Math.random() * meetNotifications.length)];
        
        const bubbleData = {
            ...randomNotification,
            id: Date.now() + Math.random(), // ID unique
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
  
                case 'generateNotification':
                    this.generateMeetNotification();
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
                    this.locateMeetButton();
                    this.updateWidgetPosition();
                    
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
  
        // Surveiller les changements de DOM qui pourraient affecter le bouton
        const buttonObserver = new MutationObserver(() => {
            if (this.meetButtonReference && !document.contains(this.meetButtonReference)) {
                console.log('🔄 Bouton Google Meet disparu, recherche...');
                this.locateMeetButton();
                this.updateWidgetPosition();
            }
        });
  
        buttonObserver.observe(document.body, {
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
        
        // Ajouter timestamp et ID si manquants
        if (!bubbleData.timestamp) {
            bubbleData.timestamp = Date.now();
        }
        if (!bubbleData.id) {
            bubbleData.id = Date.now() + Math.random();
        }
        
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
  
  // Exposer globalement pour le debugging
  window.googleMeetWidgetManager = googleMeetWidgetManager;