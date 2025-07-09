// content.js - Script d'injection du widget React
(function() {
    'use strict';
  
    // Éviter les redéclarations
    if (window.floatingBubbleInjector) {
      return;
    }
  
    class FloatingBubbleInjector {
      constructor() {
        this.isInjected = false;
        this.iframe = null;
        this.container = null;
        this.isEnabled = true;
        this.isInitialized = false;
        
        this.init();
      }
  
      async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
  
        // Charger les préférences
        await this.loadPreferences();
        
        // Attendre que la page soit complètement chargée
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => this.injectWidget());
        } else {
          this.injectWidget();
        }
  
        // Écouter les changements de navigation (SPA)
        this.observeNavigation();
        
        // Écouter les messages de la popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          this.handleMessage(request, sender, sendResponse);
          return true;
        });
      }
  
      async loadPreferences() {
        try {
          const result = await chrome.storage.sync.get(['widgetEnabled', 'widgetPosition']);
          this.isEnabled = result.widgetEnabled !== false; // true par défaut
          this.position = result.widgetPosition || 'bottom-right';
        } catch (error) {
          console.error('Erreur lors du chargement des préférences:', error);
          this.isEnabled = true;
          this.position = 'bottom-right';
        }
      }
  
      async savePreferences() {
        try {
          await chrome.storage.sync.set({
            widgetEnabled: this.isEnabled,
            widgetPosition: this.position
          });
        } catch (error) {
          console.error('Erreur lors de la sauvegarde des préférences:', error);
        }
      }
  
      handleMessage(request, sender, sendResponse) {
        try {
          switch (request.action) {
            case 'toggle':
              this.toggleWidget();
              sendResponse({ success: true, enabled: this.isEnabled });
              break;
            case 'getStatus':
              sendResponse({ enabled: this.isEnabled, injected: this.isInjected });
              break;
            case 'updatePosition':
              this.updatePosition(request.position);
              sendResponse({ success: true });
              break;
            default:
              sendResponse({ success: false, error: 'Action inconnue' });
          }
        } catch (error) {
          console.error('Erreur dans handleMessage:', error);
          sendResponse({ success: false, error: error.message });
        }
      }
  
      observeNavigation() {
        // Observer les changements d'URL pour les SPAs
        let lastUrl = location.href;
        
        const observer = new MutationObserver(() => {
          const url = location.href;
          if (url !== lastUrl) {
            lastUrl = url;
            setTimeout(() => {
              if (this.isEnabled && this.shouldInjectOnCurrentPage()) {
                this.injectWidget();
              }
            }, 1000);
          }
        });
  
        observer.observe(document, { subtree: true, childList: true });
      }
  
      shouldInjectOnCurrentPage() {
        // Vérifier si on est sur une page Google Meet
        return window.location.hostname === 'meet.google.com' && 
               window.location.pathname.includes('/');
      }
  
      async injectWidget() {
        if (!this.isEnabled || !this.shouldInjectOnCurrentPage()) {
          return;
        }
  
        if (this.isInjected) {
          this.removeWidget();
        }
  
        try {
          // Créer le conteneur principal
          this.container = document.createElement('div');
          this.container.id = 'floating-bubbles-container';
          this.container.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            pointer-events: none !important;
            z-index: 2147483647 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          `;
  
          // Créer l'iframe isolé
          this.iframe = document.createElement('iframe');
          this.iframe.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            border: none !important;
            background: transparent !important;
            pointer-events: none !important;
            z-index: 2147483647 !important;
          `;
  
          // Charger le contenu du widget
          const widgetUrl = chrome.runtime.getURL('widget.html');
          this.iframe.src = widgetUrl;
  
          // Ajouter au DOM
          document.body.appendChild(this.container);
          this.container.appendChild(this.iframe);
  
          // Configurer la communication avec l'iframe
          this.setupIframeComm();
  
          this.isInjected = true;
          console.log('✅ Widget injecté avec succès');
  
        } catch (error) {
          console.error('❌ Erreur lors de l\'injection du widget:', error);
        }
      }
  
      setupIframeComm() {
        window.addEventListener('message', (event) => {
          // Vérifier l'origine pour la sécurité
          if (!event.origin.includes('chrome-extension://')) return;
  
          switch (event.data.type) {
            case 'WIDGET_READY':
              // Envoyer la configuration initiale
              this.iframe.contentWindow.postMessage({
                type: 'CONFIGURE',
                config: {
                  position: this.position,
                  maxBubbles: 5,
                  autoHide: false
                }
              }, '*');
              break;
  
            case 'WIDGET_INTERACTION':
              // Gérer les interactions avec le widget
              this.handleWidgetInteraction(event.data.payload);
              break;
  
            case 'API_REQUEST':
              // Proxy pour les requêtes API
              this.handleApiRequest(event.data.payload);
              break;
          }
        });
      }
  
      handleWidgetInteraction(payload) {
        // Gérer les interactions utilisateur (clics, etc.)
        console.log('Widget interaction:', payload);
      }
  
      async handleApiRequest(payload) {
        try {
          const response = await fetch(payload.url, {
            method: payload.method || 'GET',
            headers: payload.headers || {},
            body: payload.body
          });
          
          const data = await response.json();
          
          this.iframe.contentWindow.postMessage({
            type: 'API_RESPONSE',
            requestId: payload.requestId,
            data: data
          }, '*');
        } catch (error) {
          this.iframe.contentWindow.postMessage({
            type: 'API_ERROR',
            requestId: payload.requestId,
            error: error.message
          }, '*');
        }
      }
  
      toggleWidget() {
        this.isEnabled = !this.isEnabled;
        this.savePreferences();
  
        if (this.isEnabled) {
          this.injectWidget();
        } else {
          this.removeWidget();
        }
      }
  
      updatePosition(position) {
        this.position = position;
        this.savePreferences();
        
        if (this.isInjected && this.iframe) {
          this.iframe.contentWindow.postMessage({
            type: 'UPDATE_POSITION',
            position: position
          }, '*');
        }
      }
  
      removeWidget() {
        if (this.container && this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.iframe = null;
        this.isInjected = false;
        console.log('🗑️ Widget supprimé');
      }
    }
  
    // Initialiser l'injecteur
    window.floatingBubbleInjector = new FloatingBubbleInjector();
  
    // Nettoyer lors du déchargement
    window.addEventListener('beforeunload', () => {
      if (window.floatingBubbleInjector && window.floatingBubbleInjector.container) {
        window.floatingBubbleInjector.removeWidget();
      }
    });
  
  })();