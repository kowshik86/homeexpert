export const MAX_PROFILE_IMAGE_SIZE_MB = 3;

export const validateImageFile = (file, options = {}) => {
  const maxSizeMb = Number(options.maxSizeMb || MAX_PROFILE_IMAGE_SIZE_MB);

  if (!file) {
    return 'Please choose an image file.';
  }

  if (!String(file.type || '').startsWith('image/')) {
    return 'Only image files are allowed.';
  }

  const maxSizeBytes = maxSizeMb * 1024 * 1024;
  if (Number(file.size || 0) > maxSizeBytes) {
    return `Image size must be ${maxSizeMb} MB or less.`;
  }

  return '';
};

export const readImageFileAsDataUrl = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
};
