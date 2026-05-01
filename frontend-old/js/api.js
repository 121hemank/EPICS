async function analyzeReviewWithBackend(reviewText) {
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