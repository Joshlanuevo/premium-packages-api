import sharp from "sharp";

export async function compositeBannerWithLogo(bannerBuffer: Buffer, logoBuffer: Buffer | null): Promise<Buffer> {
  if (!logoBuffer) {
    return bannerBuffer;
  }

  const bannerImage = sharp(bannerBuffer);
  const metadata = await bannerImage.metadata();
  const width = metadata.width ?? 1200;
  const height = metadata.height ?? 400;

  const circleSize = width * 0.08;
  const circleX = width * 0.045;
  const circleY = height * 0.08;
  const radius = circleSize / 2;

  const padding = circleSize * 0.03;
  const innerSize = Math.round(circleSize - padding * 2);
  const innerRadius = innerSize / 2;

  const circleBaseSvg = Buffer.from(`
    <svg width="${Math.round(circleSize)}" height="${Math.round(circleSize)}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="${circleSize * 0.03}" stdDeviation="${circleSize * 0.06}" flood-color="rgba(0,0,0,0.2)" />
        </filter>
      </defs>
      <circle cx="${radius}" cy="${radius}" r="${radius - 1}" fill="#ffffff" filter="url(#shadow)" />
      <circle cx="${radius}" cy="${radius}" r="${radius - 1}" fill="none" stroke="rgba(0,0,0,0.1)" stroke-width="${Math.max(1, circleSize * 0.01)}" />
    </svg>
  `);

  const clipMaskSvg = Buffer.from(
    `<svg width="${innerSize}" height="${innerSize}" xmlns="http://www.w3.org/2000/svg"><circle cx="${innerSize / 2}" cy="${innerSize / 2}" r="${innerSize / 2}" fill="#fff"/></svg>`
  );

  const resizedLogo = await sharp(logoBuffer).resize(innerSize, innerSize, { fit: "cover" }).toBuffer();

  const clippedLogo = await sharp(resizedLogo)
    .composite([{ input: clipMaskSvg, blend: "dest-in" }])
    .png()
    .toBuffer();

  const result = await bannerImage
    .composite([
      { input: circleBaseSvg, left: Math.round(circleX), top: Math.round(circleY) },
      {
        input: clippedLogo,
        left: Math.round(circleX + padding),
        top: Math.round(circleY + padding),
      },
    ])
    .jpeg({ quality: 85 })
    .toBuffer();

  return result;
}

export async function fetchImageBuffer(url: string): Promise<Buffer> {
  const separator = url.includes("?") ? "&" : "?";
  const cacheBustedUrl = /^https?:\/\//.test(url) ? `${url}${separator}_cb=${Date.now()}` : url;

  const response = await fetch(cacheBustedUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image (HTTP ${response.status}): ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export function bufferToDataUrl(buffer: Buffer, mimeType: string = "image/jpeg"): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}