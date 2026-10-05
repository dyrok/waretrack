let token = null;

export const setToken = (value) => {
  token = value;
};

const call = async (method, path, body) => {
  const res = await fetch(path, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    // non-JSON body: fall back to the status text below
  }
  if (!res.ok) {
    const error = new Error(data.message || `${method} ${path} ${res.status}`);
    error.details = data.details || [];
    throw error;
  }
  return data;
};

export const api = (path) => call("GET", path);
export const post = (path, body) => call("POST", path, body);
export const put = (path, body) => call("PUT", path, body);
export const del = (path) => call("DELETE", path);

export const login = (email, password) => call("POST", "/api/auth/login", { email, password });
export const register = (fields) => call("POST", "/api/auth/register", fields);
