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

  async addBubble() {
    const url = "aze"; // ou dynamique plus tard

    // 1. Créer une bulle vide dès le clic
    const placeholderData = {
        title: "Chargement...",
        content: "Veuillez patienter",
        priority: "medium",
        fullDescription: "",
        id: ++this.bubbleIdCounter,
        timestamp: Date.now()
    };

    const bubble = this.createBubbleElement(placeholderData);
    this.bubbles.push({ id: placeholderData.id, element: bubble, data: placeholderData });

    const bubblesStack = document.getElementById('bubbles-stack');
    bubblesStack.insertBefore(bubble, bubblesStack.firstChild);

    console.log('🌀 Bulle placeholder créée');

    try {
        const response = await fetch(`https://dev.lili-o.com/api/prompt?url=${url}`);
        const result = await response.json();

        if (result && result.prompt) {
            // 2. Mise à jour du contenu de la bulle existante
            const updatedData = {
                ...result.prompt,
                id: placeholderData.id, // garder le même ID
                timestamp: placeholderData.timestamp
            };

            this.finishLoading(bubble, updatedData); // directement mettre à jour la bulle
        } else {
            this.finishLoading(bubble, {
                ...placeholderData,
                title: "Erreur",
                content: "Aucune donnée reçue",
            });
        }
    } catch (error) {
        console.error("Erreur lors de la récupération de la bulle depuis le serveur:", error);
        this.finishLoading(bubble, {
            ...placeholderData,
            title: "Erreur",
            content: "Impossible de récupérer les données"
        });
    }
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

    // Attach event listener safely
    const closeButton = bubble.querySelector('.bubble-close');
    closeButton.addEventListener('click', () => {
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