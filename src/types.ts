export interface Credentials {
  access_token: string;
  refresh_token: string;
  username: string;
}

export interface Profile {
  id: string;
  name: string;
  gender: string | null;
  gender_probability: number;
  age: number;
  age_group: string;
  country_id: string;
  country_name: string;
  country_probability: number;
  created_at: string;
}

export interface PaginatedResponse<T> {
  status: string;
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  data: T[];
}

export interface ApiError {
  status: "error";
  message: string;
}
