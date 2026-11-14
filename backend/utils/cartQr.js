const QRCode = require('qrcode')
const { PutObjectCommand } = require('@aws-sdk/client-s3')
const { s3Client } = require('./s3Client')

/**
 * Draws the QR for <customerAppUrl>/c/<cartId>, uploads it to S3 as
 * qrs/<cartId>.png (replacing any older one) and returns its URL.
 */
async function uploadCartQr(cartId, customerAppUrl) {
  const png = await QRCode.toBuffer(`${customerAppUrl}/c/${cartId}`, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    quality: 0.95,
    margin: 2,
    scale: 10,
    width: 1024,
    color: { light: '#FFFFFF' },
  })
  const bucket = process.env.BUCKET_NAME
  const key = `qrs/${cartId}.png`
  await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: png, ContentType: 'image/png' }))
  return `https://${bucket}.s3.amazonaws.com/${key}`
}

module.exports = { uploadCartQr }
