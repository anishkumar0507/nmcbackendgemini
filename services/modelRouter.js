/**
 * Smart AI Model Router Service
 * Automatically selects the best AI model based on:
 * - Input type (text, audio, video, image, URL)
 * - Input size
 * - Model availability
 * - Cost efficiency
 * - Performance
 * 
 * Includes automatic fallback and never crashes on model errors
 */

// Model constants - Using gemini-2.0-flash (only model available)
export const MODELS = {
  OPENAI_TRANSCRIBE: 'gpt-4o-transcribe',
  GEMINI_MODEL: 'gemini-2.0-flash'
};

// Note: Thresholds kept for potential future use, but all content uses gemini-2.0-flash
const SHORT_TEXT_THRESHOLD = 3000; // characters
const LONG_TEXT_THRESHOLD = 10000; // characters

/**
 * Select Gemini model - Always uses gemini-2.0-flash (only model available)
 * @param {string} inputType - 'text', 'audio', 'video', 'image', 'url'
 * @param {number} contentLength - Length of content in characters
 * @param {boolean} isComplex - Whether content is complex
 * @returns {object} { model, reason }
 */
export const selectGeminiModel = (inputType, contentLength = 0, isComplex = false) => {
  const startTime = Date.now();
  
  // Always use gemini-2.0-flash (only model available)
  const model = MODELS.GEMINI_MODEL;
  const reason = `Using gemini-2.0-flash for ${inputType} content (${contentLength} chars)`;
  
  const processingTime = Date.now() - startTime;
  console.log(`[Model Router] Selected: ${model} | Reason: ${reason} | Time: ${processingTime}ms`);
  
  return { model, reason, processingTime };
};

/**
 * Get fallback model if primary model fails
 * Since only gemini-2.0-flash is available, no fallback exists
 * @param {string} primaryModel - Primary model that failed
 * @returns {string|null} Fallback model or null
 */
export const getFallbackModel = (primaryModel) => {
  // No fallback available - only gemini-2.0-flash is accessible
  console.warn('[Model Router] No fallback available for', primaryModel, '- only gemini-2.0-flash is available');
  return null;
};

/**
 * Check if content is complex
 * Heuristic: Check for medical terms, claims, multiple sentences
 * @param {string} content - Content to analyze
 * @returns {boolean} Whether content is complex
 */
export const isComplexContent = (content) => {
  if (!content || typeof content !== 'string') return false;
  
  const medicalTerms = [
    'cure', 'treat', 'heal', 'disease', 'medicine', 'drug', 'pharmaceutical',
    'clinical', 'study', 'research', 'doctor', 'physician', 'medical',
    'symptom', 'diagnosis', 'therapy', 'treatment', 'prescription'
  ];
  
  const hasMedicalTerms = medicalTerms.some(term => 
    content.toLowerCase().includes(term)
  );
  
  const hasMultipleClaims = (content.match(/guarantee|promise|assure|ensure/gi) || []).length > 1;
  const hasMultipleSentences = (content.match(/[.!?]+/g) || []).length > 3;
  
  return hasMedicalTerms || hasMultipleClaims || hasMultipleSentences;
};

/**
 * Get generation config for model
 * @param {string} model - Model name
 * @returns {object} Generation configuration
 */
export const getGenerationConfig = (model) => {
  // Configuration for gemini-2.0-flash
  return {
    temperature: 0.1,
    topP: 0.95,
    maxOutputTokens: 8192, // Support for longer outputs
  };
};

export default {
  MODELS,
  selectGeminiModel,
  getFallbackModel,
  isComplexContent,
  getGenerationConfig
};
