/**
 * Claims Extractor Service
 * Extracts only marketing or medical claims from content before sending to Gemini
 * This optimizes token usage and reduces costs
 */

/**
 * Extract marketing and medical claims from content
 * Uses simple heuristics to identify claims
 * @param {string} content - Full content text
 * @returns {string} Extracted claims
 */
export const extractClaims = (content) => {
  if (!content || typeof content !== 'string') {
    return content;
  }
  
  // Medical/health claim indicators
  const claimPatterns = [
    // Health claims
    /(?:cure|cures|cured|curing)\s+[^.!?]+/gi,
    /(?:treat|treats|treated|treating)\s+[^.!?]+/gi,
    /(?:heal|heals|healed|healing)\s+[^.!?]+/gi,
    /(?:prevent|prevents|prevented|preventing)\s+[^.!?]+/gi,
    /(?:guarantee|guarantees|guaranteed)\s+[^.!?]+/gi,
    /(?:promise|promises|promised)\s+[^.!?]+/gi,
    /(?:assure|assures|assured)\s+[^.!?]+/gi,
    /(?:ensure|ensures|ensured)\s+[^.!?]+/gi,
    
    // Medical terms
    /(?:medicine|drug|pharmaceutical|treatment|therapy|diagnosis|symptom)[^.!?]*/gi,
    
    // Effectiveness claims
    /(?:effective|efficacy|works|results|improves|enhances|boosts)[^.!?]*/gi,
    
    // Comparison claims
    /(?:better|best|faster|stronger|more effective)[^.!?]*/gi,
    
    // Number-based claims
    /\d+%\s+(?:effective|success|improvement|cure|treat)[^.!?]*/gi,
    /(?:in\s+)?\d+\s+(?:days|weeks|months|hours)[^.!?]*/gi
  ];
  
  const extractedClaims = [];
  const seenClaims = new Set();
  
  // Extract sentences containing claims
  claimPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const trimmed = match.trim();
        if (trimmed.length > 10 && !seenClaims.has(trimmed.toLowerCase())) {
          extractedClaims.push(trimmed);
          seenClaims.add(trimmed.toLowerCase());
        }
      });
    }
  });
  
  // If no specific claims found, extract sentences with medical/health keywords
  if (extractedClaims.length === 0) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const medicalKeywords = ['health', 'medical', 'disease', 'symptom', 'treatment', 'cure', 'medicine'];
    
    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase();
      if (medicalKeywords.some(keyword => lowerSentence.includes(keyword))) {
        const trimmed = sentence.trim();
        if (!seenClaims.has(trimmed.toLowerCase())) {
          extractedClaims.push(trimmed);
          seenClaims.add(trimmed.toLowerCase());
        }
      }
    });
  }
  
  // If still no claims, return first 500 characters (fallback)
  if (extractedClaims.length === 0) {
    return content.substring(0, 500) + (content.length > 500 ? '...' : '');
  }
  
  // Combine extracted claims
  const claimsText = extractedClaims.join('. ') + '.';
  
  // Limit to reasonable size (prevent token explosion)
  const maxLength = 5000;
  if (claimsText.length > maxLength) {
    return claimsText.substring(0, maxLength) + '...';
  }
  
  return claimsText;
};

/**
 * Check if content should be optimized (extract claims)
 * @param {string} content - Content to check
 * @returns {boolean} Whether to extract claims
 */
export const shouldExtractClaims = (content) => {
  if (!content || typeof content !== 'string') return false;
  
  // Extract claims if content is longer than threshold
  const EXTRACTION_THRESHOLD = 2000; // characters
  return content.length > EXTRACTION_THRESHOLD;
};

export default {
  extractClaims,
  shouldExtractClaims
};
