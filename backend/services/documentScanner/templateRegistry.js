// ============================================================
// TEMPLATE REGISTRY
// Config-driven registry for document classification and parsing.
// Adding a new vendor template requires only adding a new JSON
// config in backend/config/templates/ plus a test — no code change.
// ============================================================

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'config', 'templates');

class TemplateRegistry {
  constructor() {
    this.templates = new Map();
    this.genericSynonyms = {};
    this.loadTemplates();
  }

  loadTemplates() {
    try {
      const genericPath = path.join(TEMPLATES_DIR, 'generic_synonyms.json');
      if (fs.existsSync(genericPath)) {
        this.genericSynonyms = JSON.parse(fs.readFileSync(genericPath, 'utf8'));
      }

      const files = fs.readdirSync(TEMPLATES_DIR);
      for (const file of files) {
        if (file.endsWith('.json') && file !== 'generic_synonyms.json') {
          const filePath = path.join(TEMPLATES_DIR, file);
          const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (config && config.id) {
            this.templates.set(config.id, config);
          }
        }
      }
    } catch (err) {
      console.error('[TEMPLATE-REGISTRY] Error loading template configs:', err.message);
    }
  }

  getTemplate(templateId) {
    return this.templates.get(templateId) || null;
  }

  getAllTemplates() {
    return Array.from(this.templates.values());
  }

  getSynonymsForField(fieldName, templateId = null) {
    const list = [];
    if (templateId && this.templates.has(templateId)) {
      const tmpl = this.templates.get(templateId);
      if (tmpl.sections) {
        for (const sec of tmpl.sections) {
          if (sec.labels && sec.labels[fieldName]) {
            list.push(...sec.labels[fieldName]);
          }
        }
      }
    }
    if (this.genericSynonyms[fieldName]) {
      list.push(...this.genericSynonyms[fieldName]);
    }
    // Deduplicate preserving case
    return Array.from(new Set(list));
  }

  /**
   * Classifies document text against loaded templates
   * Returns { templateId, documentType, confidence }
   */
  classify(text) {
    if (!text || typeof text !== 'string') {
      return { templateId: 'unknown_template', documentType: 'unknown', confidence: 0 };
    }

    const cleanText = text.replace(/\s+/g, ' ');

    // 1. Check vendor fitment templates first
    for (const [id, tmpl] of this.templates.entries()) {
      const req = tmpl.classification?.required_keywords || [];
      const allRequiredMatch = req.length > 0 && req.every(kw => cleanText.includes(kw));
      if (allRequiredMatch) {
        return {
          templateId: id,
          documentType: tmpl.document_type || 'fitment_certificate',
          confidence: 0.98
        };
      }
    }

    // 2. Check RC keywords
    if (/REGISTRATION CERTIFICATE|TRANSPORT DEPARTMENT|FORM 23|VEHICLE CLASS|CHASSIS NO/i.test(cleanText) &&
        /ENGINE NO|MAKER|REGN\.?\s*NO/i.test(cleanText)) {
      return {
        templateId: 'rc_card',
        documentType: 'rc',
        confidence: 0.92
      };
    }

    // 3. Check Aadhaar keywords
    if (/GOVERNMENT OF INDIA|UNIQUE IDENTIFICATION AUTHORITY|AADHAAR|DOB\s*:\s*\d|YEAR OF BIRTH/i.test(cleanText) ||
        /\b\d{4}\s\d{4}\s\d{4}\b/.test(cleanText)) {
      return {
        templateId: 'aadhaar_card',
        documentType: 'aadhaar',
        confidence: 0.95
      };
    }

    return {
      templateId: 'unknown_template',
      documentType: 'unknown',
      confidence: 0.3
    };
  }
}

module.exports = new TemplateRegistry();
