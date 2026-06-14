import {
  TCreateServicePayload,
  TService,
  TServiceCategory,
  TUpdateServicePayload,
} from "@/types/services";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function getServices(search?: string): Promise<TService[]> {
  const url = new URL(`${API_URL}/services`);
  if (search?.trim()) {
    url.searchParams.set("search", search.trim());
  }

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Не удалось загрузить услуги");
  }

  return res.json();
}

export async function getServiceCategories(): Promise<TServiceCategory[]> {
  const res = await fetch(`${API_URL}/services/categories`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Не удалось загрузить категории");
  }

  return res.json();
}

export async function createService(payload: TCreateServicePayload): Promise<TService> {
  const res = await fetch(`${API_URL}/services`, {
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
  const res = await fetch(`${API_URL}/services/${id}`, {
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
  const res = await fetch(`${API_URL}/services/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error("Не удалось удалить услугу");
  }

  return res.json();
}