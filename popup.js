class PopupController {
    constructor() {
        this.toggle = document.getElementById('toggle-widget');
        this.statusDiv = document.getElementById('status');
        this.positionButtons = document.querySelectorAll('.position-button');
        
        this.init();
    }
    
    async init() {
        await this.loadStatus();
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.toggle.addEventListener('change', () => {
            this.toggleWidget();
        });
        
        this.positionButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.changePosition(button.dataset.position);
            });
        });
    }
    
    async loadStatus() {
        try {
            // Vérifier l'onglet actuel
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const isGoogleMeet = tab.url && tab.url.includes('meet.google.com');
            
            if (!isGoogleMeet) {
                this.showStatus('not-meet', '⚠️ Ouvrez Google Meet pour utiliser l\'extension');
                this.toggle.disabled = true;
                return;
            }
            
            // Obtenir le statut du widget
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
            
            if (response) {
                this.toggle.checked = response.enabled;
                this.toggle.disabled = false;
                
                if (response.enabled) {
                    this.showStatus('enabled', '✅ Widget activé et fonctionnel');
                } else {
                    this.showStatus('disabled', '❌ Widget désactivé');
                }
                
                // Charger la position actuelle
                await this.loadPosition();
            } else {
                this.showStatus('disabled', '❌ Impossible de communiquer avec le widget');
                this.toggle.disabled = true;
            }
            
        } catch (error) {
            this.showStatus('disabled', '❌ Erreur de communication');
            this.toggle.disabled = true;
        }
    }
    
    async loadPosition() {
        const result = await chrome.storage.sync.get(['widgetPosition']);
        const position = result.widgetPosition || 'bottom-right';
        
        this.positionButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.position === position);
        });
    }
    
    showStatus(type, message) {
        this.statusDiv.className = `status ${type}`;
        this.statusDiv.textContent = message;
    }
    
    async toggleWidget() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'toggle' });
            
            if (response && response.success) {
                if (response.enabled) {
                    this.showStatus('enabled', '✅ Widget activé');
                } else {
                    this.showStatus('disabled', '❌ Widget désactivé');
                }
            }
        } catch (error) {
            this.showStatus('disabled', '❌ Erreur lors du basculement');
            this.toggle.checked = !this.toggle.checked; // Revenir à l'état précédent
        }
    }
    
    async changePosition(position) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, { 
                action: 'updatePosition', 
                position 
            });
            
            if (response && response.success) {
                this.positionButtons.forEach(button => {
                    button.classList.toggle('active', button.dataset.position === position);
                });
            }
        } catch (error) {
            console.error('Erreur lors du changement de position:', error);
        }
    }
}

// Initialiser le contrôleur
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});