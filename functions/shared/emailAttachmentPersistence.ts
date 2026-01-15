/**
 * Email Attachment Persistence Helper
 * Safely persists email attachments to linked Project/Contract documents.
 * Includes deduplication to prevent saving the same attachment multiple times.
 */

/**
 * Check if attachment is eligible for persistence
 * Skips:
 *   - Inline attachments (signatures, embedded images)
 *   - Small images likely to be signatures/logos (< 30KB)
 *   - Files with signature-related names
 */
export function isEligibleEmailAttachment(att) {
  if (!att || !att.filename || !att.data) return false;
  
  // Skip inline attachments (embedded in email body)
  if (att.is_inline === true || att.contentId) return false;
  
  // Estimate size in bytes (rough: base64 is ~1.33x the original size)
  const estimatedSize = Math.ceil((att.data.length * 3) / 4);
  
  // Skip small images (likely logos/signatures)
  if (att.mimeType?.startsWith('image/') && estimatedSize < 10000) return false;
  
  // Skip files with signature-related names and small size
  const lowerName = att.filename.toLowerCase();
  if ((lowerName.includes('signature') || lowerName.includes('logo')) && estimatedSize < 30000) {
    return false;
  }
  
  return true;
}

/**
 * Compute deterministic fingerprint for attachment
 * Uses SHA-256 hash of (filename + mimeType + size + first chunk)
 * to uniquely identify attachments for deduplication
 */
export async function computeAttachmentFingerprint(att) {
  if (!att || !att.filename || !att.data) return null;
  
  try {
    // Estimate size
    const estimatedSize = Math.ceil((att.data.length * 3) / 4);
    
    // Get first ~8KB of data for hashing (avoid hashing entire file)
    const chunkSize = 8192;
    const firstChunk = att.data.substring(0, chunkSize);
    
    // Create composite string: filename | mimeType | size | chunk
    const composite = `${att.filename}|${att.mimeType || 'unknown'}|${estimatedSize}|${firstChunk}`;
    
    // Hash using SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(composite);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  } catch (error) {
    console.error('[emailAttachmentPersistence] Error computing fingerprint:', error);
    return null;
  }
}

/**
 * Extract existing fingerprints from documents array
 * Supports both legacy string URLs and new structured objects
 */
export function extractFingerprintsFromDocs(docs) {
  if (!docs || !Array.isArray(docs)) return new Set();
  
  const fingerprints = new Set();
  
  for (const doc of docs) {
    if (typeof doc === 'string') {
      // Legacy: check for query param or suffix format
      // Format: "url?fp=<fingerprint>" or "url|fp:<fingerprint>"
      const fpMatch = doc.match(/[?|]fp:?([a-f0-9]+)/) || doc.match(/\|fp:([a-f0-9]+)/);
      if (fpMatch && fpMatch[1]) {
        fingerprints.add(fpMatch[1]);
      }
    } else if (doc && typeof doc === 'object' && doc.fingerprint) {
      // Structured: object with fingerprint property
      fingerprints.add(doc.fingerprint);
    }
  }
  
  return fingerprints;
}

/**
 * Persist attachments to a Project or Contract
 * Handles upload and deduplication automatically.
 * Returns metadata about what was uploaded, deduped, etc.
 */
export async function persistAttachmentsToEntity({
  base44,
  entityType, // 'project' or 'contract'
  entityId,
  threadId,
  messageId,
  attachments
}) {
  const result = {
    eligible: 0,
    skipped: 0,
    deduped: 0,
    uploaded: 0,
    persisted: 0,
    errors: []
  };
  
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return result;
  }
  
  try {
    // Fetch current entity
    const entityKey = entityType === 'contract' ? 'Contract' : 'Project';
    const entity = await base44.asServiceRole.entities[entityKey].get(entityId);
    if (!entity) {
      result.errors.push(`Entity ${entityType}/${entityId} not found`);
      return result;
    }
    
    // Get documents array (schema-specific)
    const docsArrayKey = 'other_documents'; // Both Project and Contract use this
    let docs = entity[docsArrayKey] || [];
    if (!Array.isArray(docs)) docs = [];
    
    // Extract existing fingerprints for deduplication
    const existingFingerprints = extractFingerprintsFromDocs(docs);
    
    // Process each attachment
    for (const att of attachments) {
      // Check eligibility
      if (!isEligibleEmailAttachment(att)) {
        result.skipped++;
        continue;
      }
      
      result.eligible++;
      
      try {
        // Compute fingerprint
        const fingerprint = await computeAttachmentFingerprint(att);
        if (!fingerprint) {
          result.errors.push(`Failed to compute fingerprint for ${att.filename}`);
          continue;
        }
        
        // Check if already persisted (dedupe)
        if (existingFingerprints.has(fingerprint)) {
          result.deduped++;
          continue;
        }
        
        // Upload attachment to storage
        let uploadedUrl;
        try {
          const fileUploadResponse = await base44.integrations.Core.UploadFile({
            file: att.data // base64 or binary data expected
          });
          uploadedUrl = fileUploadResponse.file_url;
          result.uploaded++;
        } catch (uploadError) {
          result.errors.push(`Upload failed for ${att.filename}: ${uploadError.message}`);
          continue;
        }
        
        // Append to docs array with fingerprint metadata
        // Format: structured object with url, name, fingerprint, source, thread_id
        const docEntry = {
          url: uploadedUrl,
          name: att.filename,
          fingerprint: fingerprint, // Store for future dedupe checks
          source: 'email',
          thread_id: threadId,
          message_id: messageId
        };
        
        docs.push(docEntry);
        existingFingerprints.add(fingerprint); // Mark as processed in this batch
        result.persisted++;
      } catch (error) {
        result.errors.push(`Error processing ${att.filename}: ${error.message}`);
      }
    }
    
    // Update entity with new docs array (only if something was persisted)
    if (result.persisted > 0) {
      try {
        const updatePayload = { [docsArrayKey]: docs };
        await base44.asServiceRole.entities[entityKey].update(entityId, updatePayload);
      } catch (updateError) {
        result.errors.push(`Failed to update entity docs: ${updateError.message}`);
        // Do not throw; attachments were uploaded but not linked—log warning
        console.warn(`[persistAttachmentsToEntity] Uploaded ${result.persisted} attachments but failed to update entity: ${updateError.message}`);
      }
    }
  } catch (error) {
    result.errors.push(`Fatal error: ${error.message}`);
    console.error('[persistAttachmentsToEntity] Fatal:', error);
  }
  
  return result;
}