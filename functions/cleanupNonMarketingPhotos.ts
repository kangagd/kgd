import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Fetch all photos that are NOT marketing approved
    const allPhotos = await base44.asServiceRole.entities.Photo.list();
    const photosToDelete = allPhotos.filter(photo => !photo.is_marketing_approved);

    console.log(`Found ${photosToDelete.length} non-marketing photos to delete`);

    // Delete them from the Photo entity
    // Note: The actual image URLs remain in job.image_urls arrays
    const deletePromises = photosToDelete.map(photo => 
      base44.asServiceRole.entities.Photo.delete(photo.id)
    );

    await Promise.all(deletePromises);

    return Response.json({ 
      success: true,
      deleted_count: photosToDelete.length,
      message: `Removed ${photosToDelete.length} non-marketing photos from central gallery. Photos remain on their respective jobs.`
    });
  } catch (error) {
    console.error('Error cleaning up photos:', error);
    return Response.json({ 
      error: error.message || 'Failed to cleanup photos'
    }, { status: 500 });
  }
});