import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const fixEncodingIssues = (text) => {
  if (!text) return text;
  
  let fixed = text;
  
  // Fix HTML entities first
  fixed = fixed.replace(/&nbsp;/g, ' ');
  fixed = fixed.replace(/&amp;/g, '&');
  fixed = fixed.replace(/&lt;/g, '<');
  fixed = fixed.replace(/&gt;/g, '>');
  fixed = fixed.replace(/&quot;/g, '"');
  fixed = fixed.replace(/&#39;/g, "'");
  fixed = fixed.replace(/&apos;/g, "'");
  fixed = fixed.replace(/&#8217;/g, "'");
  fixed = fixed.replace(/&#8216;/g, "'");
  fixed = fixed.replace(/&#8220;/g, '"');
  fixed = fixed.replace(/&#8221;/g, '"');
  fixed = fixed.replace(/&#8211;/g, '–');
  fixed = fixed.replace(/&#8212;/g, '—');
  
  // Fix double-encoded UTF-8 mojibake patterns
  fixed = fixed.replace(/â€™/g, "'");
  fixed = fixed.replace(/â€˜/g, "'");
  fixed = fixed.replace(/â€œ/g, '"');
  fixed = fixed.replace(/â€/g, '"');
  fixed = fixed.replace(/â€"/g, '—');
  fixed = fixed.replace(/â€"/g, '–');
  fixed = fixed.replace(/â€¦/g, '…');
  fixed = fixed.replace(/â€¢/g, '•');
  
  // Space patterns
  fixed = fixed.replace(/Â /g, ' ');
  fixed = fixed.replace(/Â/g, ' ');
  fixed = fixed.replace(/â€‰/g, ' ');
  fixed = fixed.replace(/â €/g, ' ');
  fixed = fixed.replace(/â ·/g, '·');
  
  // Other patterns
  fixed = fixed.replace(/â ·â(\d+)/g, ' ·$1');
  fixed = fixed.replace(/Ã¢â‚¬â„¢/g, "'");
  fixed = fixed.replace(/Â°/g, '°');
  fixed = fixed.replace(/â‚¬/g, '€');
  
  // Accented characters
  fixed = fixed.replace(/Ã /g, 'à');
  fixed = fixed.replace(/Ã¡/g, 'á');
  fixed = fixed.replace(/Ã¢/g, 'â');
  fixed = fixed.replace(/Ã£/g, 'ã');
  fixed = fixed.replace(/Ã¤/g, 'ä');
  fixed = fixed.replace(/Ã¨/g, 'è');
  fixed = fixed.replace(/Ã©/g, 'é');
  fixed = fixed.replace(/Ãª/g, 'ê');
  fixed = fixed.replace(/Ã«/g, 'ë');
  fixed = fixed.replace(/Ã¬/g, 'ì');
  fixed = fixed.replace(/Ã­/g, 'í');
  fixed = fixed.replace(/Ã®/g, 'î');
  fixed = fixed.replace(/Ã¯/g, 'ï');
  fixed = fixed.replace(/Ã²/g, 'ò');
  fixed = fixed.replace(/Ã³/g, 'ó');
  fixed = fixed.replace(/Ã´/g, 'ô');
  fixed = fixed.replace(/Ãµ/g, 'õ');
  fixed = fixed.replace(/Ã¶/g, 'ö');
  fixed = fixed.replace(/Ã¹/g, 'ù');
  fixed = fixed.replace(/Ãº/g, 'ú');
  fixed = fixed.replace(/Ã»/g, 'û');
  fixed = fixed.replace(/Ã¼/g, 'ü');
  
  return fixed;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all email messages
    const messages = await base44.asServiceRole.entities.EmailMessage.list();
    
    let updatedCount = 0;
    const batchSize = 50;
    
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      const updates = batch.map(async (message) => {
        const updates = {};
        let hasChanges = false;
        
        if (message.body_html) {
          const fixed = fixEncodingIssues(message.body_html);
          if (fixed !== message.body_html) {
            updates.body_html = fixed;
            hasChanges = true;
          }
        }
        
        if (message.body_text) {
          const fixed = fixEncodingIssues(message.body_text);
          if (fixed !== message.body_text) {
            updates.body_text = fixed;
            hasChanges = true;
          }
        }
        
        if (message.subject) {
          const fixed = fixEncodingIssues(message.subject);
          if (fixed !== message.subject) {
            updates.subject = fixed;
            hasChanges = true;
          }
        }
        
        if (hasChanges) {
          await base44.asServiceRole.entities.EmailMessage.update(message.id, updates);
          return 1;
        }
        return 0;
      });
      
      const results = await Promise.all(updates);
      updatedCount += results.reduce((sum, val) => sum + val, 0);
    }
    
    return Response.json({ 
      success: true, 
      totalMessages: messages.length,
      updatedCount 
    });
  } catch (error) {
    console.error('Error fixing email encoding:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});