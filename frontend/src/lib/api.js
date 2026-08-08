import { BACKEND_URL } from '../config';

export async function analyzeReviewWithBackend(reviewText) {
  const response = await fetch(`${BACKEND_URL}/compare`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: reviewText
    })
  });

  if (!response.ok) {
    throw new Error("Backend analysis failed");
  }

  return await response.json();
}

export async function analyzeReviewsBatch(reviewTexts) {
  const response = await fetch(`${BACKEND_URL}/compare_batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      texts: reviewTexts
    })
  });

  if (!response.ok) {
    throw new Error("Backend batch analysis failed");
  }

  const data = await response.json();
  return data.results || [];
}
