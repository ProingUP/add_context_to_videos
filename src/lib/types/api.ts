export type ApiResponse =
| { success: true; message?: string }
| { success: false; error: string; message?: string };

export type ApiResponseWithData<T> =
| { success: true; message?: string; data: T }
| { success: false; error: string; message?: string };