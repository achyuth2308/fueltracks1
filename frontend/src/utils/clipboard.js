/**
 * Cross-environment clipboard copy utility that works reliably across
 * both secure contexts (HTTPS / localhost) and non-secure contexts (LAN IPs like http://172.21.64.1:5173).
 */
export const copyToClipboard = async (text) => {
  if (!text) return false;

  // 1. Try modern navigator.clipboard if in secure context
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Proceed to fallback
    }
  }

  // 2. Fallback for non-secure contexts (HTTP over IP address)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  }
};

