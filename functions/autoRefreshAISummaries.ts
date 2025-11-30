import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        // Note: This might be called by a cron job or manually.
        // If cron, we might need a service key or check for specific header.
        // For now, assuming standard auth or admin call.
        
        // If called from scheduled task (no user), use service role directly?
        // Base44 auth.me() might fail if no token. 
        // Let's assume this is triggered by an admin/manager via UI or a cron that signs a token.
        // Or we can just check if we have a valid service role context.
        
        // Fetch jobs for next 48 hours
        const now = new Date();
        const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        
        const todayStr = now.toISOString().split('T')[0];
        const futureStr = in48Hours.toISOString().split('T')[0];

        // Filter for scheduled jobs
        const jobs = await base44.asServiceRole.entities.Job.filter({
            status: { $in: ['Scheduled', 'Open'] },
            scheduled_date: { $gte: todayStr, $lte: futureStr }
        });

        console.log(`Refreshing AI summaries for ${jobs.length} jobs...`);

        // Process in batches to avoid timeouts
        const results = [];
        for (const job of jobs) {
            try {
                // Call generateJobAISummary logic. 
                // Since we can't easily import the other function file in Deno Deploy environment (unless exported),
                // We will call it via base44.functions.invoke if possible, OR duplicate the logic.
                // Calling via invoke is cleaner but might hit recursion limits or strict auth.
                // Let's use invoke.
                
                // await base44.asServiceRole.functions.invoke('generateJobAISummary', { job_id: job.id });
                
                // However, invoke() requires HTTP overhead. 
                // Re-implementing core logic or extracting a shared util is better, 
                // but Deno Deploy structure here is flat files.
                // Let's use invoke for simplicity as per instructions "use standard SDK".
                
                await base44.asServiceRole.functions.invoke('generateJobAISummary', { job_id: job.id });
                results.push({ id: job.id, status: 'success' });
                
            } catch (e) {
                console.error(`Failed to refresh summary for job ${job.id}`, e);
                results.push({ id: job.id, status: 'failed', error: e.message });
            }
        }

        return Response.json({ 
            success: true, 
            processed: jobs.length,
            results: results 
        });

    } catch (error) {
        console.error("Auto Refresh Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});