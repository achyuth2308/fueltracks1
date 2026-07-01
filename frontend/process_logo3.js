import sharp from 'sharp';

async function makeTransparent() {
  try {
    // 1. First add alpha channel
    // 2. Then remove the black color
    
    // We can use sharp's raw pixel manipulation safely this way:
    const { data, info } = await sharp('./public/logo_cropped.jpeg')
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
      
    // info.channels will be 4
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 30 && data[i + 1] < 30 && data[i + 2] < 30) {
        data[i + 3] = 0; // set alpha to 0 for black pixels
      }
    }
    
    await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4
      }
    })
    .png()
    .toFile('./public/logo_final_transparent.png');
    
    console.log('Saved transparent logo.');
  } catch (err) {
    console.error(err);
  }
}

makeTransparent();
