import { supabase } from './supabase-client';

// ---- Activity Log ----
async function getCurrentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id;
}

export async function logActivity(orgId, action, entityType, entityName, details) {
  const userId = await getCurrentUserId();
  if (!userId || !orgId) return;
  try {
    await supabase.from("activity_logs").insert([{
      organization_id: orgId,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_name: entityName,
      details: details ? String(details).slice(0, 500) : null
    }]);
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}

export async function loadActivityLogs(orgId, limit = 20) {
  const { data, error } = await supabase.rpc('get_org_activity_logs', {
    p_org_id: orgId,
    p_limit: limit
  });
  if (error) { console.error(error); return []; }
  return (data || []).map(r => ({ ...r, user: { email: r.user_email } }));
}

// ---- Auth ----
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin }
  });
  if (error) throw error;
  return data;
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

// ---- Organizations ----
export async function createOrganization(name) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const id = crypto.randomUUID();

  const { error: orgError } = await supabase
    .from('organizations')
    .insert([{ id, name }]);
  if (orgError) throw orgError;

  const { error: memberError } = await supabase
    .from('organization_members')
    .insert([{
      organization_id: id,
      user_id: user.id,
      role: 'admin',
      status: 'active'
    }]);
  if (memberError) throw memberError;

  logActivity(id, 'create', 'organization', name, `Organization created: ${name}`);

  return { id, name, created_at: new Date().toISOString() };
}

export async function updateOrganization(orgId, payload) {
  const { error } = await supabase
    .from('organizations')
    .update(payload)
    .eq('id', orgId);
  if (error) throw error;
}

export async function inviteMember(orgId, email, role) {
  const currentUser = (await supabase.auth.getUser()).data.user;
  const token = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

  const { data: existingUserId, error: lookupError } = await supabase
    .rpc('get_user_id_by_email', { p_email: email.trim() });
  if (lookupError) throw lookupError;

  if (existingUserId) {
    const { error } = await supabase
      .from('organization_members')
      .insert([{
        organization_id: orgId,
        user_id: existingUserId,
        role,
        status: 'pending',
        invited_by: currentUser?.id
      }]);
    if (error) throw error;
  }

  const { error: invError } = await supabase
    .from('invitations')
    .insert([{
      organization_id: orgId,
      email: email.trim(),
      role,
      token,
      invited_by: currentUser?.id
    }]);
  if (invError) throw invError;

  logActivity(orgId, 'invite', 'member', email, `Invited ${email} as ${role}`);
  return `${window.location.origin}/accept-invite?token=${token}`;
}

export async function acceptInvitation(token) {
  const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
  if (error) throw error;
  return data;
}

export async function updateMemberRole(memberId, role, orgId) {
  const { error } = await supabase
    .from('organization_members')
    .update({ role })
    .eq('id', memberId);
  if (error) throw error;
  logActivity(orgId, 'update', 'member', memberId, `Member role changed to ${role}`);
}

export async function recoverOrgOwner(orgId) {
  const { data, error } = await supabase.rpc('recover_org_owner', { p_org_id: orgId });
  if (error) throw error;
  return data;
}

export async function removeMember(userId, orgId) {
  const { data, error } = await supabase.rpc('remove_org_member', {
    p_org_id: orgId,
    p_user_id: userId
  });
  if (error) throw error;
  if (data === false) {
    throw new Error('Member row not found — they may already be removed. Refresh the list.');
  }
  logActivity(orgId, 'delete', 'member', userId, 'Member removed from organization');
}

export async function loadPendingInvites(userId) {
  const { data, error } = await supabase
    .from('organization_members')
    .select('*, organization:organizations(*)')
    .eq('user_id', userId)
    .eq('status', 'pending');
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function acceptInvite(memberId) {
  const { error } = await supabase
    .from('organization_members')
    .update({ status: 'active' })
    .eq('id', memberId);
  if (error) throw error;
}

export async function declineInvite(memberId) {
  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', memberId);
  if (error) throw error;
}

// ---- Vendor Scores ----
export async function loadVendorScores(orgId) {
  const { data, error } = await supabase
    .from("vendor_scores")
    .select("*")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function loadVendorScoreByName(vendorName, orgId) {
  const { data, error } = await supabase
    .from("vendor_scores")
    .select("*")
    .ilike("vendor_name", vendorName)
    .eq("organization_id", orgId);
  if (error) { console.error(error); return null; }
  return data && data.length ? data[0] : null;
}

export async function upsertVendorScore(vendorName, rating, finalSentiment, finalScore, orgId) {
  const { data: existing, error: fetchError } = await supabase
    .from("vendor_scores")
    .select("*")
    .eq("vendor_name", vendorName)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  let positive = 0, neutral = 0, negative = 0;
  if (finalSentiment === "Positive") positive = 1;
  if (finalSentiment === "Neutral") neutral = 1;
  if (finalSentiment === "Negative") negative = 1;

  if (!existing) {
    const { error } = await supabase.from("vendor_scores").insert([{
      vendor_name: vendorName,
      organization_id: orgId,
      total_reviews: 1,
      avg_rating: Number(rating),
      positive_reviews: positive,
      neutral_reviews: neutral,
      negative_reviews: negative,
      vendor_score: Number(finalScore)
    }]);
    if (error) throw error;
  } else {
    const totalReviews = existing.total_reviews + 1;
    const avgRating = ((Number(existing.avg_rating) * existing.total_reviews) + Number(rating)) / totalReviews;
    const vendorScore = ((Number(existing.vendor_score) * existing.total_reviews) + Number(finalScore)) / totalReviews;
    const { error } = await supabase
      .from("vendor_scores")
      .update({
        total_reviews: totalReviews,
        avg_rating: avgRating,
        positive_reviews: existing.positive_reviews + positive,
        neutral_reviews: existing.neutral_reviews + neutral,
        negative_reviews: existing.negative_reviews + negative,
        vendor_score: vendorScore,
        updated_at: new Date().toISOString()
      })
      .eq("vendor_name", vendorName)
      .eq("organization_id", orgId);
    if (error) throw error;
  }
  logActivity(orgId, 'update', 'score', vendorName, `Vendor score updated for ${vendorName} (rating: ${rating})`);
}

// ---- Vendors ----
export async function loadVendors(orgId) {
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function updateVendor(vendorId, payload, orgId) {
  const { error } = await supabase.from("vendors").update(payload).eq("id", vendorId);
  if (error) throw error;
  if (payload.onboarding_status) {
    logActivity(orgId, 'update', 'vendor', payload.vendor_name || vendorId, `Vendor status changed to ${payload.onboarding_status}`);
  }
}

export async function deleteVendor(vendorId, orgId, vendorName) {
  const { error } = await supabase.from("vendors").delete().eq("id", vendorId);
  if (error) throw error;
  logActivity(orgId, 'delete', 'vendor', vendorName, `Vendor deleted: ${vendorName}`);
}

// ---- Vendor Reviews ----
export async function saveVendorReview(payload) {
  const { error } = await supabase.from("vendor_reviews").insert([payload]);
  if (error) throw error;
  logActivity(payload.organization_id, 'create', 'review', payload.customer_name, `Review submitted for ${payload.vendor_name} (rating: ${payload.rating})`);
}

export async function loadReviewHistory(orgId) {
  const { data, error } = await supabase
    .from("vendor_reviews")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function loadAllVendorReviews(orgId) {
  const { data, error } = await supabase
    .from("vendor_reviews")
    .select("*")
    .eq("organization_id", orgId);
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function loadVendorReviewsByName(vendorName, orgId) {
  const { data, error } = await supabase
    .from("vendor_reviews")
    .select("*")
    .ilike("vendor_name", vendorName)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

// ---- Customers ----
export async function loadCustomers(orgId) {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("organization_id", orgId)
    .order("latest_review_date", { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function upsertCustomer(customerName, vendorName, rating, reviewText, orgId) {
  const { data: existing, error: fetchError } = await supabase
    .from("customers")
    .select("*")
    .eq("customer_name", customerName)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const latestReviewDate = new Date().toISOString();

  if (!existing) {
    const { error } = await supabase.from("customers").insert([{
      customer_name: customerName,
      organization_id: orgId,
      vendor_name: vendorName,
      total_reviews: 1,
      avg_rating: Number(rating),
      latest_review: reviewText,
      latest_review_date: latestReviewDate,
      status: "Active"
    }]);
    if (error) throw error;
  } else {
    const totalReviews = existing.total_reviews + 1;
    const avgRating = ((Number(existing.avg_rating) * existing.total_reviews) + Number(rating)) / totalReviews;
    const { error } = await supabase
      .from("customers")
      .update({
        vendor_name: vendorName,
        total_reviews: totalReviews,
        avg_rating: avgRating,
        latest_review: reviewText,
        latest_review_date: latestReviewDate,
        status: "Active"
      })
      .eq("customer_name", customerName)
      .eq("organization_id", orgId);
    if (error) throw error;
  }
  logActivity(orgId, existing ? 'update' : 'create', 'customer', customerName, `Customer ${existing ? 'updated' : 'created'}: ${customerName} (vendor: ${vendorName})`);
}

// ---- Leads ----
export async function saveLead(payload) {
  const { error } = await supabase.from("leads").insert([payload]);
  if (error) throw error;
  logActivity(payload.organization_id, 'create', 'lead', payload.vendor_name, `Lead created: ${payload.vendor_name}`);
}

export async function loadLeads(orgId) {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function updateLead(leadId, payload, orgId) {
  const { error } = await supabase.from("leads").update(payload).eq("id", leadId);
  if (error) throw error;
  if (payload.status === 'Won' || payload.status === 'Lost') {
    logActivity(orgId, 'update', 'lead', payload.vendor_name || leadId, `Lead marked as ${payload.status}`);
  }
}

export async function deleteLeadById(leadId, orgId, vendorName) {
  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) throw error;
  logActivity(orgId, 'delete', 'lead', vendorName, `Lead deleted: ${vendorName}`);
}

export async function upsertVendorFromLead(lead, orgId) {
  const { data: existing, error: fetchError } = await supabase
    .from("vendors")
    .select("*")
    .eq("vendor_name", lead.vendor_name)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (!existing) {
    const { error } = await supabase.from("vendors").insert([{
      vendor_name: lead.vendor_name,
      organization_id: orgId,
      contact_person: lead.contact_person,
      contact_email: lead.contact_email,
      contact_phone: lead.contact_phone,
      onboarding_status: "Active",
      source_lead_id: lead.id
    }]);
    if (error) throw error;
    logActivity(orgId, 'convert', 'lead', lead.vendor_name, `Lead converted to vendor: ${lead.vendor_name}`);
  } else {
    const { error } = await supabase.from("vendors").update({
      contact_person: lead.contact_person,
      contact_email: lead.contact_email,
      contact_phone: lead.contact_phone,
      onboarding_status: "Active",
      source_lead_id: lead.id
    }).eq("vendor_name", lead.vendor_name).eq("organization_id", orgId);
    if (error) throw error;
    logActivity(orgId, 'convert', 'lead', lead.vendor_name, `Lead converted to vendor (existing): ${lead.vendor_name}`);
  }
}

export async function deleteVendorByLead(lead) {
  if (!lead || !lead.vendor_name) return;
  const { error } = await supabase.from("vendors").delete().eq("vendor_name", lead.vendor_name);
  if (error) throw error;
}

export async function deleteVendorScoresByName(name) {
  const { error } = await supabase.from("vendor_scores").delete().eq("vendor_name", name);
  if (error) throw error;
}

export async function deleteVendorReviewsByName(name) {
  const { error } = await supabase.from("vendor_reviews").delete().eq("vendor_name", name);
  if (error) throw error;
}

export async function unlinkCustomerVendor(name) {
  const { error } = await supabase.from("customers").update({ vendor_name: null }).eq("vendor_name", name);
  if (error) throw error;
}
