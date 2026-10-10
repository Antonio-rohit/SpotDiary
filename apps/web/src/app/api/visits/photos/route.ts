import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getCurrentUser } from '@/lib/auth/session';
import { getCollection } from '@/lib/db/dbAdapter';
import { saveVisitPhoto, deleteVisitPhoto, StorageValidationError } from '@/lib/storage/storageAdapter';
import { PhotoUploadMetadataSchema } from '@spotdiary/shared';

export async function POST(request: Request) {
  let savedStoragePath: string | null = null;
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to upload photos.' },
        { status: 401 }
      );
    }

    // Enforce Content-Length header check before request parsing (413 Payload Too Large)
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Payload size exceeds the 5MB maximum file upload limit.' },
        { status: 413 }
      );
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: 'Invalid form data payload.' }, { status: 400 });
    }

    const visit_id = formData.get('visit_id') as string;
    const caption = (formData.get('caption') as string) || '';
    const file = formData.get('file') as File | null;

    // Validate metadata
    const metaParse = PhotoUploadMetadataSchema.safeParse({ visit_id, caption });
    if (!metaParse.success) {
      return NextResponse.json(
        { error: 'Invalid metadata parameters.', details: metaParse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json({ error: 'Image file is required.' }, { status: 400 });
    }

    // Ownership Authorization Check: User must own the visit
    const visitsCollection = await getCollection('visits');
    const existingVisit = await visitsCollection.findOne({ id: visit_id, user_id: user.id });

    if (!existingVisit) {
      return NextResponse.json(
        { error: 'Visit record not found or unauthorized.' },
        { status: 404 }
      );
    }

    // Validate mime type (415 Unsupported Media Type)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP images are permitted.' },
        { status: 415 }
      );
    }

    // Validate file size (413 Payload Too Large)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds the 5MB maximum limit.' },
        { status: 413 }
      );
    }

    // Read file buffer and save using storage adapter
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await saveVisitPhoto(buffer, file.type, file.name);
    savedStoragePath = uploadResult.storage_path;

    // Save photo record in MongoDB
    const photoDoc = {
      id: `photo-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      visit_id,
      user_id: user.id,
      storage_path: uploadResult.storage_path,
      url: uploadResult.url,
      caption: caption.trim(),
      created_at: new Date().toISOString(),
    };

    const visitPhotosCollection = await getCollection('visit_photos');
    await visitPhotosCollection.insertOne(photoDoc);

    // Append photo URL to the visit document
    await visitsCollection.updateOne(
      { id: visit_id, user_id: user.id },
      {
        $addToSet: { photos: uploadResult.url },
        $set: { updated_at: new Date().toISOString() },
      }
    );

    return NextResponse.json({
      success: true,
      photo: photoDoc,
    });
  } catch (error: any) {
    // Partial Failure Rollback: Delete file if MongoDB operations fail after file creation
    if (savedStoragePath) {
      await deleteVisitPhoto(savedStoragePath).catch(() => {});
    }

    // Return client errors (413/415) when thrown by storage validation
    if (error instanceof StorageValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    // Never expose stack traces or internal filesystem paths on 500 errors
    const rawMessage = error?.message || 'An unexpected error occurred while uploading the photo.';
    const sanitizedMessage = rawMessage
      .replace(/[a-zA-Z]:\\[^\s'"]+/g, '[storage_path]')
      .replace(/\/[\w.-]+(\/[\w.-]+)+/g, '[storage_path]');

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred while uploading the photo.'
            : sanitizedMessage,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to remove photos.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const visit_id = searchParams.get('visit_id');
    const photo_url = searchParams.get('url');
    const photo_id = searchParams.get('photo_id');

    if (!visit_id || (!photo_url && !photo_id)) {
      return NextResponse.json(
        { error: 'visit_id and either photo_id or url are required.' },
        { status: 400 }
      );
    }

    if (photo_url && (photo_url.includes('..') || photo_url.includes('\0'))) {
      return NextResponse.json(
        { error: 'Invalid photo URL parameter.' },
        { status: 400 }
      );
    }

    // Ownership Authorization Check: User must own the visit
    const visitsCollection = await getCollection('visits');
    const existingVisit = await visitsCollection.findOne({ id: visit_id, user_id: user.id });

    if (!existingVisit) {
      return NextResponse.json(
        { error: 'Visit record not found or unauthorized.' },
        { status: 404 }
      );
    }

    const visitPhotosCollection = await getCollection('visit_photos');
    let targetPhoto: any = null;

    if (photo_id) {
      targetPhoto = await visitPhotosCollection.findOne({ id: photo_id, user_id: user.id });
    } else if (photo_url) {
      targetPhoto = await visitPhotosCollection.findOne({ url: photo_url, user_id: user.id });
    }

    const targetUrl = photo_url || (targetPhoto ? targetPhoto.url : null);
    const isPhotoInVisit = existingVisit.photos && Array.isArray(existingVisit.photos) && existingVisit.photos.includes(targetUrl);

    if (!targetPhoto && !isPhotoInVisit) {
      return NextResponse.json(
        { error: 'Photograph not found or unauthorized.' },
        { status: 404 }
      );
    }

    const storagePath = targetPhoto ? targetPhoto.storage_path : targetUrl;

    if (storagePath) {
      await deleteVisitPhoto(storagePath);
    }

    if (targetPhoto) {
      await visitPhotosCollection.deleteOne({ id: targetPhoto.id, user_id: user.id });
    }

    if (targetUrl) {
      await visitsCollection.updateOne(
        { id: visit_id, user_id: user.id },
        {
          $pull: { photos: targetUrl },
          $set: { updated_at: new Date().toISOString() },
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Photograph deleted successfully.',
    });
  } catch (error: any) {
    const rawMessage = error?.message || 'An unexpected error occurred while deleting the photo.';
    const sanitizedMessage = rawMessage
      .replace(/[a-zA-Z]:\\[^\s'"]+/g, '[storage_path]')
      .replace(/\/[\w.-]+(\/[\w.-]+)+/g, '[storage_path]');

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred while deleting the photo.'
            : sanitizedMessage,
      },
      { status: 500 }
    );
  }
}
