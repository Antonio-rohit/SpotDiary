import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (!apiKey) {
    return new NextResponse('API Key not configured', { status: 400 });
  }

  if (!name) {
    return new NextResponse('Photo resource name required', { status: 400 });
  }

  // Security check: validate resource format to prevent SSRF
  // Expected format: places/{place_id}/photos/{photo_id}
  const resourcePattern = /^places\/[a-zA-Z0-9_-]+\/photos\/[a-zA-Z0-9_-]+$/;
  if (!resourcePattern.test(name)) {
    return new NextResponse('Invalid photo resource format', { status: 400 });
  }

  try {
    // Construct Google Places API (New) photo media URL
    const googlePhotoUrl = `https://places.googleapis.com/v1/${name}/media?maxHeightPx=800&maxWidthPx=800&key=${apiKey}`;

    // Redirect to the photo stream or proxy response securely
    return NextResponse.redirect(googlePhotoUrl, {
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400'
      }
    });
  } catch (error: any) {
    return new NextResponse('Failed to fetch photo resource', { status: 500 });
  }
}
