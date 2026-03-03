import axios, { type AxiosInstance } from 'axios';

export class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string, token?: string) {
    this.client = axios.create({ baseURL });
    if (token) {
      this.client.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
  }

  public setToken(token: string): void {
    this.client.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  public async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  public async post<T>(url: string, body?: unknown): Promise<T> {
    const response = await this.client.post<T>(url, body);
    return response.data;
  }

  public async put<T>(url: string, body?: unknown): Promise<T> {
    const response = await this.client.put<T>(url, body);
    return response.data;
  }

  public async delete(url: string): Promise<void> {
    await this.client.delete(url);
  }
}
