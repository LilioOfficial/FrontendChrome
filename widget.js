class FloatingBubblesWidget {
    constructor() {
        this.container = document.getElementById('widget-container');
        this.bubbles = [];
        this.config = {
            position: 'bottom-right',
            maxBubbles: 5,
            autoHide: false
        };
        this.init();
    }
    
    init() {
        this.createInitialBubbles();
        this.setupEventListeners();
        this.notifyParent('WIDGET_READY');
    }
    
    createInitialBubbles() {
        const bubbleData = [
            { id: 1, content: '🎯', size: 'medium', tooltip: 'Objectif de la réunion' },
            { id: 2, content: '💡', size: 'small', tooltip: 'Idées et suggestions' },
            { id: 3, content: '📝', size: 'medium', tooltip: 'Prendre des notes' },
            { id: 4, content: '🚀', size: 'large', tooltip: 'Actions à entreprendre' },
            { id: 5, content: '❓', size: 'small', tooltip: 'Questions' }
        ];
        
        bubbleData.forEach(data => {
            this.createBubble(data);
        });
    }
    
    createBubble(data) {
        const bubble = document.createElement('div');
        bubble.className = `bubble ${data.size} ${this.config.position}`;
        bubble.dataset.id = data.id;
        bubble.style.zIndex = '10000';
        
        const content = document.createElement('div');
        content.className = 'bubble-content';
        content.textContent = data.content;
        
        const tooltip = document.createElement('div');
        tooltip.className = 'bubble-tooltip';
        tooltip.textContent = data.tooltip;
        
        bubble.appendChild(content);
        bubble.appendChild(tooltip);
        
        // Positionner les bulles selon la configuration
        this.positionBubble(bubble, this.bubbles.length);
        
        // Ajouter des effets visuels
        if (Math.random() > 0.5) {
            bubble.classList.add('floating');
        } else {
            bubble.classList.add('pulse');
        }
        
        this.container.appendChild(bubble);
        this.bubbles.push(bubble);
        
        // Ajouter les event listeners
        bubble.addEventListener('click', () => {
            this.handleBubbleClick(data);
        });
        
        bubble.addEventListener('mouseenter', () => {
            tooltip.style.opacity = '1';
        });
        
        bubble.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
        });
    }
    
    positionBubble(bubble, index) {
        const positions = {
            'bottom-right': { bottom: 20 + (index * 70), right: 20 },
            'bottom-left': { bottom: 20 + (index * 70), left: 20 },
            'top-right': { top: 20 + (index * 70), right: 20 },
            'top-left': { top: 20 + (index * 70), left: 20 }
        };
        
        const pos = positions[this.config.position];
        Object.keys(pos).forEach(key => {
            bubble.style[key] = pos[key] + 'px';
        });
    }
    
    handleBubbleClick(data) {
        console.log('Bubble clicked:', data);
        
        // Effet visuel de clic
        const bubble = this.container.querySelector(`[data-id="${data.id}"]`);
        bubble.style.transform = 'scale(0.9)';
        setTimeout(() => {
            bubble.style.transform = '';
        }, 150);
        
        // Notifier le parent
        this.notifyParent('WIDGET_INTERACTION', {
            type: 'bubble_click',
            bubbleId: data.id,
            content: data.content,
            tooltip: data.tooltip
        });
    }
    
    setupEventListeners() {
        window.addEventListener('message', (event) => {
            switch (event.data.type) {
                case 'CONFIGURE':
                    this.updateConfig(event.data.config);
                    break;
                case 'UPDATE_POSITION':
                    this.updatePosition(event.data.position);
                    break;
                case 'ADD_BUBBLE':
                    this.addBubble(event.data.bubble);
                    break;
                case 'REMOVE_BUBBLE':
                    this.removeBubble(event.data.bubbleId);
                    break;
            }
        });
    }
    
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        this.repositionBubbles();
    }
    
    updatePosition(position) {
        this.config.position = position;
        this.repositionBubbles();
    }
    
    repositionBubbles() {
        this.bubbles.forEach((bubble, index) => {
            bubble.className = bubble.className.replace(/(top|bottom)-(left|right)/, '');
            bubble.classList.add(this.config.position);
            this.positionBubble(bubble, index);
        });
    }
    
    addBubble(bubbleData) {
        if (this.bubbles.length < this.config.maxBubbles) {
            this.createBubble(bubbleData);
        }
    }
    
    removeBubble(bubbleId) {
        const bubble = this.container.querySelector(`[data-id="${bubbleId}"]`);
        if (bubble) {
            bubble.remove();
            this.bubbles = this.bubbles.filter(b => b.dataset.id !== bubbleId);
            this.repositionBubbles();
        }
    }
    
    notifyParent(type, payload = {}) {
        window.parent.postMessage({
            type: type,
            payload: payload
        }, '*');
    }
}

// Initialiser le widget
document.addEventListener('DOMContentLoaded', () => {
    new FloatingBubblesWidget();
});