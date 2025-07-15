// widget.js - Logique mise à jour pour les nouvelles spécifications
class BubbleWidget {
  constructor() {
      this.bubbles = [];
      this.bubbleIdCounter = 0;
      this.maxBubbles = 5;
      this.init();
  }

  init() {
      console.log('Initialisation du widget de bulles...');
      this.setupEventListeners();
      this.setupMessaging();
      this.notifyReady();
  }

  setupEventListeners() {
      const addButton = document.getElementById('add-bubble-btn');
      if (addButton) {
          console.log('✅ Bouton d\'ajout trouvé dans le DOM');
          addButton.addEventListener('click', () => {
              this.addBubble();
          });
      } else {
          console.warn('❌ Bouton d\'ajout non trouvé dans le DOM');
      }
  }

  setupMessaging() {
      // Écouter les messages du content script
      window.addEventListener('message', (event) => {
          if (event.data.type) {
              this.handleMessage(event.data);
          }
      });
  }

  handleMessage(message) {
      console.log('Message reçu:', message);
      
      switch (message.type) {
          case 'ADD_BUBBLE':
              if (message.bubble) {
                  this.addBubbleFromData(message.bubble);
              }
              break;
          case 'CONFIGURE':
              if (message.config) {
                  this.configure(message.config);
              }
              break;
          case 'TOGGLE_VISIBILITY':
              this.toggleVisibility(message.visible);
              break;
          case 'UPDATE_POSITION':
              this.updatePosition(message.position);
              break;
          default:
              console.log('Type de message non reconnu:', message.type);
      }
  }

  addBubble() {
      const sampleBubbles = [
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
              title: 'Qualité réseau',
              content: 'Connexion stable',
              priority: 'low',
              fullDescription: 'Votre connexion réseau est stable. La réunion devrait se dérouler sans problème.'
          }
      ];

      const randomBubble = sampleBubbles[Math.floor(Math.random() * sampleBubbles.length)];
      
      const bubbleData = {
          ...randomBubble,
          id: ++this.bubbleIdCounter,
          timestamp: Date.now()
      };

      this.addBubbleFromData(bubbleData);
  }

  addBubbleFromData(bubbleData) {
      // Vérifier la limite de bulles
      if (this.bubbles.length >= this.maxBubbles) {
          this.removeOldestBubble();
      }

      const bubble = this.createBubbleElement(bubbleData);
      this.bubbles.push({ id: bubbleData.id, element: bubble, data: bubbleData });

      // Ajouter au début du stack (pour que les nouvelles bulles apparaissent en haut)
      const bubblesStack = document.getElementById('bubbles-stack');
      bubblesStack.insertBefore(bubble, bubblesStack.firstChild);

      // Démarrer l'animation de chargement
      this.startLoadingAnimation(bubble, bubbleData);

      console.log('Bulle ajoutée:', bubbleData.title);
  }

  createBubbleElement(bubbleData) {
      const bubble = document.createElement('div');
      bubble.className = 'notification-bubble bubble-loading';
      bubble.setAttribute('data-bubble-id', bubbleData.id);

      bubble.innerHTML = `
          <div class="bubble-header">
              <div class="bubble-title">${bubbleData.title}</div>
              <button class="bubble-close">×</button>
          </div>
          <div class="bubble-content">${bubbleData.content}</div>
          <div class="bubble-time">${this.formatTime(bubbleData.timestamp)}</div>
      `;


      bubble.addEventListener('click', () => {
            // Envoyer une interaction au content script
            this.removeBubble(bubbleData.id);
        });
      return bubble;
  }

  startLoadingAnimation(bubble, bubbleData) {
      // Afficher l'animation de chargement pendant 2 secondes
      setTimeout(() => {
          this.finishLoading(bubble, bubbleData);
      }, 2000);
  }

  finishLoading(bubble, bubbleData) {
      // Retirer la classe de chargement
      bubble.classList.remove('bubble-loading');

      // Mettre à jour le contenu avec le texte réel
      const titleElement = bubble.querySelector('.bubble-title');
      const contentElement = bubble.querySelector('.bubble-content');
      
      if (titleElement) {
          titleElement.textContent = bubbleData.title;
      }
      
      if (contentElement) {
          contentElement.textContent = bubbleData.content;
      }

      console.log('Chargement terminé pour:', bubbleData.title);
  }

  removeBubble(bubbleId) {
      const bubbleIndex = this.bubbles.findIndex(b => b.id === bubbleId);
      console.log('Tentative de suppression de la bulle avec ID:', bubbleId);
      if (bubbleIndex !== -1) {
          const bubble = this.bubbles[bubbleIndex];
          
          // Ajouter la classe d'animation de sortie
          bubble.element.classList.add('removing');
          
          // Supprimer l'élément après l'animation
          setTimeout(() => {
              if (bubble.element.parentNode) {
                  bubble.element.parentNode.removeChild(bubble.element);
              }
              this.bubbles.splice(bubbleIndex, 1);
              console.log('Bulle supprimée:', bubbleId);
          }, 300);
      }
  }

  removeOldestBubble() {
      if (this.bubbles.length > 0) {
          const oldestBubble = this.bubbles[this.bubbles.length - 1];
          this.removeBubble(oldestBubble.id);
      }
  }

  formatTime(timestamp) {
      const now = new Date();
      const bubbleTime = new Date(timestamp);
      const diffMs = now - bubbleTime;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) {
          return 'Maintenant';
      } else if (diffMins < 60) {
          return `Il y a ${diffMins} min`;
      } else {
          const diffHours = Math.floor(diffMins / 60);
          return `Il y a ${diffHours}h`;
      }
  }

  configure(config) {
      if (config.maxBubbles) {
          this.maxBubbles = config.maxBubbles;
      }
      console.log('Configuration mise à jour:', config);
  }

  toggleVisibility(visible) {
      const container = document.getElementById('widget-container');
      const button = document.getElementById('add-bubble-btn');
      
      if (container && button) {
          container.style.display = visible ? 'block' : 'none';
          button.style.display = visible ? 'flex' : 'none';
      }
  }

  updatePosition(position) {
      // Cette méthode peut être utilisée pour des ajustements futurs
      console.log('Position mise à jour vers:', position);
  }

  notifyReady() {
      // Informer le content script que le widget est prêt
      if (window.parent !== window) {
          window.parent.postMessage({
              type: 'WIDGET_READY'
          }, '*');
      }
  }

  sendInteraction(type, data) {
      // Envoyer des interactions au content script
      if (window.parent !== window) {
          window.parent.postMessage({
              type: 'WIDGET_INTERACTION',
              payload: { type, data }
          }, '*');
      }
  }
}

// Initialiser le widget
const bubbleWidget = new BubbleWidget();

// Exposer globalement pour les événements onclick
window.bubbleWidget = bubbleWidget;

console.log('Widget de bulles initialisé avec succès');