export async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function readArrayResponse<T>(
  response: Response,
  resourceName: string
): Promise<T[]> {
  const payload = await readJsonBody(response);

  if (!response.ok) {
    console.error(`${resourceName} request failed`, {
      status: response.status,
      payload,
    });
    return [];
  }

  if (!Array.isArray(payload)) {
    console.error(`${resourceName} returned a non-array payload`, payload);
    return [];
  }

  return payload as T[];
}

export async function readObjectResponse<T extends object>(
  response: Response,
  resourceName: string
): Promise<T | null> {
  const payload = await readJsonBody(response);

  if (!response.ok) {
    console.error(`${resourceName} request failed`, {
      status: response.status,
      payload,
    });
    return null;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    console.error(`${resourceName} returned an invalid payload`, payload);
    return null;
  }

  return payload as T;
}
