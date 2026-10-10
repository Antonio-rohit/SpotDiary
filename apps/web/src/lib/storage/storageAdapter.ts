import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface UploadedFileResult {
  filename: string;
  storage_path: string;
  url: string;
}

export class StorageValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'StorageValidationError';
    this.status = status;
  }
}

export function getUploadsDir(): string {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'visits');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
}

export function isStorageConfigured(): boolean {
  if (process.env.STORAGE_TYPE === 's3') {
    return !!(
      process.env.AWS_S3_BUCKET &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
    );
  }

  // In production, prevent silent reliance on ephemeral local storage without explicit opt-in
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_LOCAL_STORAGE !== 'true') {
    return false;
  }

  return true;
}

/**
 * Inspect image header magic bytes (JPEG, PNG, WebP)
 * Rejects spoofed content-types or renamed executable/text files
 */
export function detectImageMagicBytes(buffer: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return 'png';
  }

  // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}

/**
 * AWS S3 SigV4 Upload Implementation
 */
async function savePhotoToS3(buffer: Buffer, filename: string, contentType: string): Promise<UploadedFileResult> {
  const bucket = process.env.AWS_S3_BUCKET!;
  const region = process.env.AWS_REGION || 'ap-south-1';
  const key = `uploads/visits/${filename}`;
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const endpoint = `https://${host}/${key}`;

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY!;

  const date = new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);

  const payloadHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `PUT\n/${key}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

  const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'Authorization': authorizationHeader,
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`S3 upload failed with HTTP ${res.status}: ${errText}`);
  }

  return {
    filename,
    storage_path: `s3://${bucket}/${key}`,
    url: endpoint,
  };
}

/**
 * AWS S3 SigV4 Delete Implementation
 */
async function deletePhotoFromS3(storagePath: string): Promise<boolean> {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return false;
  }
  const region = process.env.AWS_REGION || 'ap-south-1';
  const key = storagePath.startsWith('s3://')
    ? storagePath.replace(`s3://${bucket}/`, '')
    : storagePath.replace(/^https:\/\/[^/]+\//, '');
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const endpoint = `https://${host}/${key}`;

  const date = new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  const payloadHash = crypto.createHash('sha256').update('').digest('hex');
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `DELETE\n/${key}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;

  const kDate = crypto.createHmac('sha256', `AWS4${process.env.AWS_SECRET_ACCESS_KEY}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorizationHeader = `${algorithm} Credential=${process.env.AWS_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'Authorization': authorizationHeader,
    },
  });

  return res.ok || res.status === 204;
}

export async function saveVisitPhoto(
  buffer: Buffer,
  mimeType: string,
  originalFilename?: string
): Promise<UploadedFileResult> {
  if (!isStorageConfigured()) {
    throw new Error('Object storage service is not configured for production. Please set AWS_S3_BUCKET credentials in environment variables.');
  }

  // Enforce 5MB size limit
  const maxSizeBytes = 5 * 1024 * 1024;
  if (buffer.length > maxSizeBytes) {
    throw new StorageValidationError('File size exceeds the 5MB maximum limit.', 413);
  }

  // Validate image magic bytes to prevent content spoofing
  const detectedFormat = detectImageMagicBytes(buffer);
  if (!detectedFormat) {
    throw new StorageValidationError('Invalid file content. File does not contain valid JPEG, PNG, or WebP image data.', 415);
  }

  // Determine file extension
  const ext = detectedFormat;

  // Generate secure server-side random filename (never trust client filename)
  const uniqueFilename = `photo-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;

  if (process.env.STORAGE_TYPE === 's3') {
    return await savePhotoToS3(buffer, uniqueFilename, `image/${ext}`);
  }

  const uploadsDir = getUploadsDir();
  const filePath = path.join(uploadsDir, uniqueFilename);

  fs.writeFileSync(filePath, buffer);

  const relativePath = `uploads/visits/${uniqueFilename}`;
  const publicUrl = `/${relativePath}`;

  return {
    filename: uniqueFilename,
    storage_path: relativePath,
    url: publicUrl,
  };
}

export async function deleteVisitPhoto(relativePathOrUrl: string): Promise<boolean> {
  try {
    if (!relativePathOrUrl || relativePathOrUrl.includes('..') || relativePathOrUrl.includes('\0')) {
      return false;
    }

    if (relativePathOrUrl.startsWith('s3://') || (process.env.STORAGE_TYPE === 's3' && relativePathOrUrl.startsWith('http'))) {
      return await deletePhotoFromS3(relativePathOrUrl);
    }

    const cleanPath = relativePathOrUrl.startsWith('/') ? relativePathOrUrl.substring(1) : relativePathOrUrl;
    const uploadsDir = path.resolve(getUploadsDir());
    const fullPath = path.resolve(process.cwd(), 'public', cleanPath);

    // Enforce Path Traversal Isolation: fullPath MUST reside within uploadsDir
    if (!fullPath.startsWith(uploadsDir)) {
      console.warn('[StorageAdapter] Path traversal deletion attempt blocked:', relativePathOrUrl);
      return false;
    }

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}
