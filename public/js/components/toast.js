/**
 * Toast Notification Component
 */
function showToast(msg, duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #4ade80;"></i> <span>${msg}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function showLoading() {
  const el = document.getElementById('loading');
  if (el) el.style.display = 'flex';
}

function hideLoading() {
  const el = document.getElementById('loading');
  if (el) el.style.display = 'none';
}
