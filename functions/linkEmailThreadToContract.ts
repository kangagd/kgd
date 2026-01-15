import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email_thread_id, contract_id, set_as_primary = false } = await req.json();

    if (!email_thread_id || !contract_id) {
      return Response.json({ 
        error: 'Missing required fields: email_thread_id and contract_id' 
      }, { status: 400 });
    }

    // Load EmailThread
    let emailThread;
    try {
      emailThread = await base44.asServiceRole.entities.EmailThread.get(email_thread_id);
    } catch (error) {
      return Response.json({ error: 'EmailThread not found' }, { status: 404 });
    }

    // Load Contract
    let contract;
    try {
      contract = await base44.asServiceRole.entities.Contract.get(contract_id);
    } catch (error) {
      return Response.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Update EmailThread with contract cached fields
    // CRITICAL: Clear project link to enforce mutual exclusivity
    const threadUpdates = {
      contract_id: contract.id,
      contract_name: contract.name || null,
      contract_status: contract.status || null,
      contract_type: contract.contract_type || null,
      organisation_id: contract.organisation_id || null,
      organisation_name: contract.organisation_name || null,
      customer_id: contract.customer_id || null,
      customer_name: contract.customer_name || null,
      linked_to_contract_at: new Date().toISOString(),
      linked_to_contract_by: user.email,
      // Clear project link (mutually exclusive)
      project_id: null,
      project_number: null,
      project_title: null,
      linked_to_project_at: null,
      linked_to_project_by: null
    };

    await base44.asServiceRole.entities.EmailThread.update(email_thread_id, threadUpdates);

    // GUARDRAIL: Optionally set as primary thread on contract ONLY if field exists and no primary exists
    if (set_as_primary && contract.primary_email_thread_id === undefined) {
      // Field doesn't exist on Contract entity - skip
      console.log('[linkEmailThreadToContract] primary_email_thread_id field not found on Contract, skipping primary assignment');
    } else if (set_as_primary && !contract.primary_email_thread_id) {
      await base44.asServiceRole.entities.Contract.update(contract_id, {
        primary_email_thread_id: email_thread_id
      });
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error('Error in linkEmailThreadToContract:', error);
    return Response.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});