function sanitizeCsvCell(value) {
  const str = String(value);
  if (/^[=+\-@]/.test(str)) {
    return `"${"'"}${str.replace(/"/g, '""')}"`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export function downloadCSV(data, headers, filename) {
  if (!data || !data.length) {
    // Use `showToast('No data to export', 'warning')` instead of alert
    return;
  }

  const csvContent = [
    headers.join(","),
    ...data.map(row =>
      headers.map(h => sanitizeCsvCell(row[h] ?? "")).join(",")
    )
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
