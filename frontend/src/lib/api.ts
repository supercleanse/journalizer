class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      // Not JSON
    }
    throw new ApiError(
      (data as { error?: string })?.error ?? `Request failed: ${response.status}`,
      response.status,
      data
    );
  }

  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),

  upload: async <T>(path: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(path, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new ApiError(
        (data as { error?: string })?.error ?? "Upload failed",
        response.status,
        data
      );
    }
    return response.json() as Promise<T>;
  },
};

export { ApiError };
