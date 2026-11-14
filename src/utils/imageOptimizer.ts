/**
 * Client-side Image Optimization Utility
 * Resizes large images to max dimensions and compresses quality using HTML5 Canvas
 * to minimize disk storage and accelerate page load performance.
 */
export async function compressAndResizeImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.82
): Promise<{ base64: string; originalSizeKB: number; compressedSizeKB: number }> {
  const originalSizeKB = Math.round(file.size / 1024);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('File yang dipilih bukan format gambar yang valid.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio scaling
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Browser tidak mendukung pemrosesan canvas.'));
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to compressed JPEG base64
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        const head = 'data:image/jpeg;base64,';
        const imageSizeInBytes = Math.round((compressedBase64.length - head.length) * 3 / 4);
        const compressedSizeKB = Math.round(imageSizeInBytes / 1024);

        resolve({
          base64: compressedBase64,
          originalSizeKB,
          compressedSizeKB,
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
