import { supabase } from './supabase-client';

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

// ---- Vendor Scores ----
export async function loadVendorScores() {
  const { data, error } = await supabase
    .from("vendor_scores")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function loadVendorScoreByName(vendorName) {
  const { data, error } = await supabase
    .from("vendor_scores")
    .select("*")
    .ilike("vendor_name", vendorName);
  if (error) { console.error(error); return null; }
  return data && data.length ? data[0] : null;
}

export async function upsertVendorScore(vendorName, rating, finalSentiment, finalScore) {
  const { data: existing, error: fetchError } = await supabase
    .from("vendor_scores")
    .select("*")
    .eq("vendor_name", vendorName)
    .maybeSingle();
  if (fetchError) throw fetchError;

  let positive = 0, neutral = 0, negative = 0;
  if (finalSentiment === "Positive") positive = 1;
  if (finalSentiment === "Neutral") neutral = 1;
  if (finalSentiment === "Negative") negative = 1;

  if (!existing) {
    const { error } = await supabase.from("vendor_scores").insert([{
      vendor_name: vendorName,
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
      .eq("vendor_name", vendorName);
    if (error) throw error;
  }
}

// ---- Vendors ----
export async function loadVendors() {
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function updateVendor(vendorId, payload) {
  const { error } = await supabase.from("vendors").update(payload).eq("id", vendorId);
  if (error) throw error;
}

export async function deleteVendor(vendorId) {
  const { error } = await supabase.from("vendors").delete().eq("id", vendorId);
  if (error) throw error;
}

// ---- Vendor Reviews ----
export async function saveVendorReview(payload) {
  const { error } = await supabase.from("vendor_reviews").insert([payload]);
  if (error) throw error;
}

export async function loadReviewHistory() {
  const { data, error } = await supabase
    .from("vendor_reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function loadAllVendorReviews() {
  const { data, error } = await supabase.from("vendor_reviews").select("*");
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function loadVendorReviewsByName(vendorName) {
  const { data, error } = await supabase
    .from("vendor_reviews")
    .select("*")
    .ilike("vendor_name", vendorName)
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

// ---- Customers ----
export async function loadCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("latest_review_date", { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function upsertCustomer(customerName, vendorName, rating, reviewText) {
  const { data: existing, error: fetchError } = await supabase
    .from("customers")
    .select("*")
    .eq("customer_name", customerName)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const latestReviewDate = new Date().toISOString();

  if (!existing) {
    const { error } = await supabase.from("customers").insert([{
      customer_name: customerName,
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
      .eq("customer_name", customerName);
    if (error) throw error;
  }
}

// ---- Leads ----
export async function saveLead(payload) {
  const { error } = await supabase.from("leads").insert([payload]);
  if (error) throw error;
}

export async function loadLeads() {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function updateLead(leadId, payload) {
  const { error } = await supabase.from("leads").update(payload).eq("id", leadId);
  if (error) throw error;
}

export async function deleteLeadById(leadId) {
  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) throw error;
}

export async function upsertVendorFromLead(lead) {
  const { data: existing, error: fetchError } = await supabase
    .from("vendors")
    .select("*")
    .eq("vendor_name", lead.vendor_name)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (!existing) {
    const { error } = await supabase.from("vendors").insert([{
      vendor_name: lead.vendor_name,
      contact_person: lead.contact_person,
      contact_email: lead.contact_email,
      contact_phone: lead.contact_phone,
      onboarding_status: "Active",
      source_lead_id: lead.id
    }]);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("vendors").update({
      contact_person: lead.contact_person,
      contact_email: lead.contact_email,
      contact_phone: lead.contact_phone,
      onboarding_status: "Active",
      source_lead_id: lead.id
    }).eq("vendor_name", lead.vendor_name);
    if (error) throw error;
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
