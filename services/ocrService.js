import vision from '@google-cloud/vision';

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

let visionClient = null;

const getVisionClient = () => {
  if (!visionClient) {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY env variable is missing');
    }
    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch (e) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
    }
    visionClient = new vision.ImageAnnotatorClient({ credentials });
    console.log('[OCR] Google Vision client initialized with env credentials');
  }
  return visionClient;
};

const validateImageBuffer = (imageBuffer) => {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    throw new Error('Invalid image buffer');
  }

  if (imageBuffer.length > MAX_IMAGE_SIZE) {
    throw new Error(`Image size exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);
  }
};

export const extractTextFromImage = async (imageBuffer) => {
  validateImageBuffer(imageBuffer);

  const client = getVisionClient();

  const [result] = await client.textDetection({
    image: { content: imageBuffer }
  });

  const text = result?.fullTextAnnotation?.text || '';

  if (!text.trim()) {
    throw new Error('Unable to extract readable text from image');
  }

  return text.trim();
};

export default {
  extractTextFromImage
};
