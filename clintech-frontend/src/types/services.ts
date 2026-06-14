export type TServiceOptions = {
  "data-price": number;
  "data-duration": number;
  "data-service_name": string;
};



export type TService = {
  id: number;
  legacy_id?: number;
  category_id: string;
  category_name: string;
  external_code?: string;
  name: string;
  service_name: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
};

export type TServiceCategory = {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
};

export type TCreateServicePayload = {
  category_id?: string;
  category_name?: string;
  legacy_id?: number;
  external_code?: string;
  name: string;
  service_name: string;
  price: number;
  duration_minutes: number;
  is_active?: boolean;
};

export type TUpdateServicePayload = Partial<TCreateServicePayload>;