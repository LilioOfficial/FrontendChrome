function updatePosition(position) {
    const container = document.getElementById('widget-container');
    const button = document.getElementById('add-bubble-btn');
  
    const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  
    positions.forEach(p => {
      container.classList.remove(`position-${p}`);
      button.classList.remove(`position-${p}`);
    });
  
    container.classList.add(`position-${position}`);
    button.classList.add(`position-${position}`);
  }
  
  // Exemple d'appel
  updatePosition('bottom-right');
  console.log('Position mise à jour vers bottom-right');
  // Bouton pour ajouter une bulle (exemple de logique)
  const button = document.getElementById('add-bubble-btn')
  if (button) {
    console.log('✅ Button is present in the DOM');
    button.addEventListener('click', () => {
      const bubble = document.createElement('div');
      bubble.className = 'notification-bubble priority-high';
      bubble.innerHTML = `
        <div class="bubble-header">
          <div class="bubble-title">Nouvelle notification</div>
          <button class="bubble-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="bubble-content">Ceci est une nouvelle bulle ajoutée dynamiquement.</div>
        <p class="bubble-time">Maintenant</p>
      `;
      
      document.getElementById('bubbles-stack').prepend(bubble);
    });
  } else {
    console.warn('❌ Button NOT found in the DOM');
  }
 