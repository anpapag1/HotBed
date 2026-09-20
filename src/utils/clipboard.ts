export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback
    }
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback clipboard copy failed:', err);
    return false;
  }
}

export function getOrderShareUrl(orderCode: string): string {
  if (typeof window === 'undefined') {
    return `#/order/${orderCode.trim().toUpperCase()}`;
  }
  const { origin, pathname } = window.location;
  // Handle paths whether ending with / or not
  const cleanPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return `${origin}${cleanPath}#/order/${orderCode.trim().toUpperCase()}`;
}

