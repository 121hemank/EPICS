function sentimentToScore(sentiment) {
  if (!sentiment) return 3;
  const s = sentiment.toLowerCase();

  if (s === "negative") return 1;
  if (s === "neutral") return 3;
  if (s === "positive") return 5;

  return 3;
}

function scoreToSentiment(score) {
  if (score <= 2) return "Negative";
  if (score <= 4) return "Neutral";
  return "Positive";
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function clearFieldErrors() {
  document.querySelectorAll(".field-error").forEach((el) => el.remove());
  document.querySelectorAll(".input-error").forEach((el) => el.classList.remove("input-error"));
}

function setFieldError(inputId, message) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.classList.add("input-error");

  const error = document.createElement("div");
  error.className = "field-error";
  error.textContent = message;

  input.parentElement.appendChild(error);
}

function validateAnalyticsForm(customerName, vendorName, rating, reviewText) {
  clearFieldErrors();
  let isValid = true;

  if (!customerName) {
    setFieldError("customerName", "Customer name is required.");
    isValid = false;
  }

  if (!vendorName) {
    setFieldError("vendorName", "Vendor name is required.");
    isValid = false;
  }

  if (!rating) {
    setFieldError("vendorRating", "Please select a rating.");
    isValid = false;
  }

  if (!reviewText) {
    setFieldError("reviewText", "Review text is required.");
    isValid = false;
  } else if (reviewText.length < 8) {
    setFieldError("reviewText", "Review should be at least 8 characters.");
    isValid = false;
  }

  return isValid;
}

async function saveVendorReview(payload) {
  const { error } = await supabaseClient
    .from("vendor_reviews")
    .insert([payload]);

  if (error) throw error;
}

async function upsertVendorScore(vendorName, rating, finalSentiment, finalScore) {
  const { data: existing, error: fetchError } = await supabaseClient
    .from("vendor_scores")
    .select("*")
    .eq("vendor_name", vendorName)
    .maybeSingle();

  if (fetchError) throw fetchError;

  let positive = 0;
  let neutral = 0;
  let negative = 0;

  if (finalSentiment === "Positive") positive = 1;
  if (finalSentiment === "Neutral") neutral = 1;
  if (finalSentiment === "Negative") negative = 1;

  if (!existing) {
    const { error: insertError } = await supabaseClient
      .from("vendor_scores")
      .insert([{
        vendor_name: vendorName,
        total_reviews: 1,
        avg_rating: Number(rating),
        positive_reviews: positive,
        neutral_reviews: neutral,
        negative_reviews: negative,
        vendor_score: Number(finalScore)
      }]);

    if (insertError) throw insertError;
  } else {
    const totalReviews = existing.total_reviews + 1;
    const avgRating =
      ((Number(existing.avg_rating) * existing.total_reviews) + Number(rating)) / totalReviews;

    const vendorScore =
      ((Number(existing.vendor_score) * existing.total_reviews) + Number(finalScore)) / totalReviews;

    const { error: updateError } = await supabaseClient
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

    if (updateError) throw updateError;
  }
}
async function upsertCustomer(customerName, vendorName, rating, reviewText) {
  const { data: existing, error: fetchError } = await supabaseClient
    .from("customers")
    .select("*")
    .eq("customer_name", customerName)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const latestReviewDate = new Date().toISOString();
  const status = "Active";

  if (!existing) {
    const { error: insertError } = await supabaseClient
      .from("customers")
      .insert([{
        customer_name: customerName,
        vendor_name: vendorName,
        total_reviews: 1,
        avg_rating: Number(rating),
        latest_review: reviewText,
        latest_review_date: latestReviewDate,
        status: status
      }]);

    if (insertError) throw insertError;
  } else {
    const totalReviews = existing.total_reviews + 1;
    const avgRating =
      ((Number(existing.avg_rating) * existing.total_reviews) + Number(rating)) / totalReviews;

    const { error: updateError } = await supabaseClient
      .from("customers")
      .update({
        vendor_name: vendorName,
        total_reviews: totalReviews,
        avg_rating: avgRating,
        latest_review: reviewText,
        latest_review_date: latestReviewDate,
        status: status
      })
      .eq("customer_name", customerName);

    if (updateError) throw updateError;
  }
}

async function handleAnalyticsSubmit(customerName, vendorName, rating, reviewText) {

if (typeof allVendorsCache !== "undefined") {
  const approved = allVendorsCache.some(v => v.vendor_name === vendorName);
  if (!approved) {
    throw new Error("Selected vendor is not approved. Please convert the vendor from Leads first.");
  }
}

  const backendResult = await analyzeReviewWithBackend(reviewText);

  const bertweetPrediction = backendResult?.bertweet?.prediction || "Neutral";
  const bertweetConfidence = backendResult?.bertweet?.confidence || 0;

  const robertaPrediction = backendResult?.roberta?.prediction || "Neutral";
  const robertaConfidence = backendResult?.roberta?.confidence || 0;

  const bertweetScore = sentimentToScore(bertweetPrediction);
  const robertaScore = sentimentToScore(robertaPrediction);

  const modelAverageScore = (bertweetScore + robertaScore) / 2;

let sentimentWeight = 50;
let ratingWeight = 50;

if (typeof getAppSettings === "function") {
  const settings = getAppSettings();
  sentimentWeight = Number(settings.sentimentWeight || 50);
  ratingWeight = Number(settings.ratingWeight || 50);
}

const finalScore =
  ((modelAverageScore * sentimentWeight) + (Number(rating) * ratingWeight)) / 100;
  const finalSentiment = scoreToSentiment(finalScore);

  const payload = {
    customer_name: customerName,
    vendor_name: vendorName,
    rating: Number(rating),
    customer_review: reviewText,
    bertweet_prediction: bertweetPrediction,
    bertweet_confidence: bertweetConfidence,
    roberta_prediction: robertaPrediction,
    roberta_confidence: robertaConfidence,
    final_sentiment: finalSentiment,
    final_score: finalScore
  };

  await saveVendorReview(payload);
await upsertVendorScore(vendorName, rating, finalSentiment, finalScore);
await upsertCustomer(customerName, vendorName, rating, reviewText);

  return {
    bertweetPrediction,
    bertweetConfidence,
    robertaPrediction,
    robertaConfidence,
    finalSentiment,
    finalScore
  };
}

function initAnalyticsForm() {
  const form = document.getElementById("vendorReviewForm");
  if (!form) return;

  const statusBox = document.getElementById("analysisStatus");
  const resultBox = document.getElementById("analysisResultBox");
  const analyzeBtn = document.getElementById("analyzeBtn");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const customerName = document.getElementById("customerName").value.trim();
    const vendorName = document.getElementById("vendorName").value.trim();
    const rating = document.getElementById("vendorRating").value;
    const reviewText = document.getElementById("reviewText").value.trim();

    const isValid = validateAnalyticsForm(customerName, vendorName, rating, reviewText);
    if (!isValid) {
      showToast("Please fix the highlighted fields.", "error");
      return;
    }

    try {
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = "Analyzing...";
      statusBox.textContent = "Running AI analysis and updating vendor score...";
      statusBox.classList.add("loading-text");
      resultBox.style.display = "none";

      const result = await handleAnalyticsSubmit(
        customerName,
        vendorName,
        rating,
        reviewText
      );

      document.getElementById("bertweetPrediction").textContent = result.bertweetPrediction;
      document.getElementById("bertweetConfidence").textContent = Number(result.bertweetConfidence).toFixed(4);
      document.getElementById("robertaPrediction").textContent = result.robertaPrediction;
      document.getElementById("robertaConfidence").textContent = Number(result.robertaConfidence).toFixed(4);
      document.getElementById("finalSentiment").textContent = result.finalSentiment;
      document.getElementById("finalScore").textContent = Number(result.finalScore).toFixed(2);

      resultBox.style.display = "block";
      statusBox.textContent = "Review analyzed and vendor score updated successfully.";
      statusBox.classList.remove("loading-text");

      await refreshAllCRMData();

      const vendorSearchInput = document.getElementById("vendorSearchInput");
      if (vendorSearchInput) {
        vendorSearchInput.value = vendorName;
        await searchVendorDetails();
      }

      form.reset();
      clearFieldErrors();
      showToast("Review submitted and vendor score updated.", "success");
    } catch (error) {
      console.error(error);
      statusBox.textContent = `Error: ${error.message}`;
      statusBox.classList.remove("loading-text");
      showToast("Analysis failed. Please try again.", "error");
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = "Analyze with AI";
    }
  });
}

document.addEventListener("DOMContentLoaded", initAnalyticsForm);