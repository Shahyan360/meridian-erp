export async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "Meridian",
      ...options.headers,
    },
    ...(options.body && typeof options.body !== "string"
      ? { body: JSON.stringify(options.body) }
      : {}),
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data.error || "We could not complete that request. Please try again.",
    );
    error.fields = data.fields;
    error.status = response.status;
    if (response.status === 401)
      window.dispatchEvent(new Event("session-expired"));
    throw error;
  }
  return data;
}
export const queryString = (params) =>
  new URLSearchParams(
    Object.entries(params).filter(
      ([, v]) => v !== "" && v !== undefined && v !== null,
    ),
  ).toString();
export async function download(path, filename) {
  const response = await fetch(`/api${path}`, { credentials: "same-origin" });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Download failed. Please try again.");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
