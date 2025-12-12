import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const fixEncodingIssues = (text) => {
  if (text == null) return text;
  let fixed = String(text);

  // 1) Common HTML entities
  fixed = fixed
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#8217;/g, "'")   // '
    .replace(/&#8216;/g, "'")   // '
    .replace(/&#8220;/g, '"')   // "
    .replace(/&#8221;/g, '"')   // "
    .replace(/&#8211;/g, "–")  // –
    .replace(/&#8212;/g, "—"); // —

  // 2) UTF-8 → Windows-1252 mojibake patterns
  const mojibakeReplacements = [
    // Smart quotes & dashes (â… sequences)
    [/â/g, "'"],
    [/â/g, "'"],
    [/â/g, """],
    [/â/g, """],
    [/â/g, "–"],
    [/â/g, "—"],
    [/â¦/g, "…"],

    // Variants already in the old helper
    [/â€™/g, "'"],
    [/â€˜/g, "'"],
    [/â€œ/g, """],
    [/â€/g, """],
    [/â€¢/g, "•"],

    // Spaces / NBSP / odd spacing
    [/Â /g, " "],
    [/Â/g, " "],
    [/â€‰/g, " "],
    [/â €/g, " "],

    // Misc symbols
    [/Â°/g, "°"],
    [/â‚¬/g, "€"],
    [/â ·/g, "·"],
    [/â ·â(\d+)/g, " ·$1"],
    [/Ã¢â‚¬â„¢/g, "'"],
  ];

  for (const [pattern, replacement] of mojibakeReplacements) {
    fixed = fixed.replace(pattern, replacement);
  }

  // 3) Accented characters (Ã… style patterns)
  const accentReplacements = [
    [/Ã /g, "à"],
    [/Ã¡/g, "á"],
    [/Ã¢/g, "â"],
    [/Ã£/g, "ã"],
    [/Ã¤/g, "ä"],
    [/Ã¨/g, "è"],
    [/Ã©/g, "é"],
    [/Ãª/g, "ê"],
    [/Ã«/g, "ë"],
    [/Ã¬/g, "ì"],
    [/Ã­/g, "í"],
    [/Ã®/g, "î"],
    [/Ã¯/g, "ï"],
    [/Ã²/g, "ò"],
    [/Ã³/g, "ó"],
    [/Ã´/g, "ô"],
    [/Ãµ/g, "õ"],
    [/Ã¶/g, "ö"],
    [/Ã¹/g, "ù"],
    [/Ãº/g, "ú"],
    [/Ã»/g, "û"],
    [/Ã¼/g, "ü"],
  ];

  for (const [pattern, replacement] of accentReplacements) {
    fixed = fixed.replace(pattern, replacement);
  }

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
    const messageArray = Array.isArray(messages) ? messages : [];
    
    let updatedCount = 0;
    
    for (const message of messageArray) {
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
        updatedCount++;
      }
    }
    
    console.log("Email encoding fix completed", { totalMessages: messageArray.length, updatedCount });
    
    return Response.json({ 
      success: true, 
      totalMessages: messageArray.length,
      updatedCount 
    });
  } catch (error) {
    console.error('Error fixing email encoding:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});