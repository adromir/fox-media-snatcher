/**
 * Internationalization helper for MediaGrab UI
 * @author Adromir
 */

const I18n = {
  getMessage(key, substitutions) {
    if (typeof browser !== 'undefined' && browser.i18n && browser.i18n.getMessage) {
      const msg = browser.i18n.getMessage(key, substitutions);
      if (msg) return msg;
    }
    return key;
  },

  /**
   * Translates all elements on the page with data-i18n attribute
   */
  applyTranslations(root = document) {
    const elements = root.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = this.getMessage(key);
      if (translation && translation !== key) {
        if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit')) {
          el.value = translation;
        } else if (el.hasAttribute('placeholder')) {
          el.setAttribute('placeholder', translation);
        } else {
          el.textContent = translation;
        }
      }
    });

    const titleElements = root.querySelectorAll('[data-i18n-title]');
    titleElements.forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const translation = this.getMessage(key);
      if (translation && translation !== key) {
        el.setAttribute('title', translation);
      }
    });
  }
};
