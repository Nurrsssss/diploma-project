import {
  TCreateServicePayload,
  TService,
  TServiceCategory,
  TUpdateServicePayload,
} from "@/types/services";

function buildUrl(path: string, params?: Record<string, string>) {
  if (!params || Object.keys(params).length === 0) {
    return path;
  }

  const search = new URLSearchParams(params);
  return `${path}?${search.toString()}`;
}

export async function getServices(search?: string): Promise<TService[]> {
  const res = await fetch(
    buildUrl("/api/services", search?.trim() ? { search: search.trim() } : undefined),
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Не удалось загрузить услуги");
  }

  return res.json();
}

export async function getServiceCategories(): Promise<TServiceCategory[]> {
  const res = await fetch("/api/services/categories", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Не удалось загрузить категории");
  }

  return res.json();
}

export async function createService(payload: TCreateServicePayload): Promise<TService> {
  const res = await fetch("/api/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Не удалось создать услугу");
  }

  return res.json();
}

export async function updateService(
  id: number,
  payload: TUpdateServicePayload
): Promise<TService> {
  const res = await fetch(`/api/services/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Не удалось обновить услугу");
  }

  return res.json();
}

export async function deleteService(id: number): Promise<{ message: string }> {
  const res = await fetch(`/api/services/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error("Не удалось удалить услугу");
  }

  return res.json();
}