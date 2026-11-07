import { NextRequest, NextResponse } from 'next/server';

const IMAGEKIT_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY || 'private_taV6bEgCHv+mAaqeIv9tpNMSqaM=';

export async function POST(req: NextRequest) {
  try {
    const { file, fileName = 'user_device.jpg', folder = '/tracksphere' } = await req.json();

    if (!file) {
      return NextResponse.json({ success: false, error: 'File data is required (base64 or URL)' }, { status: 400 });
    }

    const auth = Buffer.from(IMAGEKIT_PRIVATE_KEY + ':').toString('base64');
    const form = new FormData();
    form.append('file', file);
    form.append('fileName', fileName);
    form.append('folder', folder);

    const ikRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
      },
      body: form,
    });

    const ikData = await ikRes.json();
    if (!ikRes.ok) {
      return NextResponse.json({ success: false, error: ikData.message || 'ImageKit upload failed' }, { status: ikRes.status });
    }

    return NextResponse.json({
      success: true,
      data: {
        fileId: ikData.fileId,
        url: ikData.url,
        thumbnailUrl: ikData.thumbnailUrl,
        name: ikData.name,
      },
    });
  } catch (err: any) {
    console.error('ImageKit upload error in Next.js route:', err);
    return NextResponse.json({ success: false, error: 'Internal server error uploading image' }, { status: 500 });
  }
}
