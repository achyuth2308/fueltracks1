const Jimp = require('jimp');

async function processLogo() {
  try {
    console.log('Loading logo.jpeg...');
    const image = await Jimp.read('./public/logo.jpeg');
    
    // We want to make all black pixels transparent.
    // Also, the image has huge black borders, let's auto-crop it.
    
    // 1. Make black transparent
    console.log('Removing black background...');
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      // If the pixel is very dark, make it transparent
      if (r < 20 && g < 20 && b < 20) {
        this.bitmap.data[idx + 3] = 0; // alpha = 0
      }
    });

    // 2. Autocrop the transparent borders
    console.log('Autocropping...');
    image.autocrop();

    // 3. Save as PNG
    const outPath = './public/logo_processed.png';
    await image.writeAsync(outPath);
    console.log('Successfully saved to', outPath);
    
  } catch (error) {
    console.error('Error processing logo:', error);
  }
}

processLogo();
