/**
 * Sistema de Notificação de Bonificação
 * Verifica periodicamente se há atualizações de bonificação para o operador
 */

(function initBonusNotificationSystem() {
  const token = localStorage.getItem('token');
  if (!token) return;
  
  const payload = JSON.parse(atob(token.split('.')[1] || '{}'));
  
  // Masters não precisam de notificações
  if (payload.isMaster) return;
  
  const operatorId = payload.id;
  const wallet = payload.wallet;
  
  // Flag para evitar race conditions
  let isChecking = false;
  
  // Chave para armazenar o último bonus recebido
  const LAST_BONUS_KEY = `last-bonus-check-${operatorId}`;
  
  /**
   * Verifica atualizações de bonificação
   */
  async function checkBonusUpdates() {
    if (isChecking) return; // Evitar race condition
    
    try {
      isChecking = true;
      
      // Buscar dados do operador
      const res = await fetch(`/api/operator/${encodeURIComponent(operatorId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        isChecking = false;
        return;
      }
      
      const data = await res.json();
      
      if (data.entry && typeof data.entry.bonificacao_receber !== 'undefined') {
        const currentBonus = Number(data.entry.bonificacao_receber || 0);
        const lastBonus = Number(localStorage.getItem(LAST_BONUS_KEY) || 0);
        
        // Se há nova bonificação
        if (currentBonus > lastBonus) {
          const bonusValue = currentBonus - lastBonus;
          showBonusNotification(bonusValue, currentBonus);
          localStorage.setItem(LAST_BONUS_KEY, currentBonus.toString());
        }
      }
      
      isChecking = false;
    } catch (err) {
      console.warn('Erro ao verificar bonificação:', err);
      isChecking = false;
    }
  }
  
  /**
   * Exibe notificação de bonificação
   */
  function showBonusNotification(newBonus, totalBonus) {
    const notification = document.createElement('div');
    notification.className = 'bonus-notification';
    notification.innerHTML = `
      <div class="bonus-notification-content">
        <div class="bonus-notification-icon">🎉</div>
        <div class="bonus-notification-text">
          <strong>Bonificação Atualizada!</strong>
          <p>Você recebeu R$ ${formatarMoedaSimples(newBonus)} de bonificação.</p>
          <p style="font-size: 12px; color: #999; margin: 5px 0 0 0;">Total a receber: R$ ${formatarMoedaSimples(totalBonus)}</p>
        </div>
        <button class="bonus-notification-close" aria-label="Fechar">✕</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
    
    // Close button
    notification.querySelector('.bonus-notification-close').addEventListener('click', () => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    });
    
    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }
    }, 8000);
  }
  
  /**
   * Formata moeda simples
   */
  function formatarMoedaSimples(valor) {
    const num = Number(valor) || 0;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  
  /**
   * Inicia polling periodicamente
   */
  function startBonusPolling() {
    // Primeiro check após 5 segundos (não imediato)
    setTimeout(checkBonusUpdates, 5000);
    
    // Depois a cada 30 segundos (mais econômico)
    setInterval(checkBonusUpdates, 30000);
  }
  
  // Iniciar quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startBonusPolling);
  } else {
    startBonusPolling();
  }
})();
