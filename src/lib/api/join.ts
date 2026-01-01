import { apiFetch } from "./fetch";

export type JoinRequest = { email: string; password: string };

export type JoinResponse =
	| { success: true; message?: string }
	| { success: false; error: string; code?: string; status?: number };

function safeEmail(raw: string) {
	return raw.trim().toLowerCase();
}

function fallbackMessage(status?: number) {
	switch (status) {
		case 400:
			return 'Please check your info and try again.';
		case 403:
			return 'Sign-up is blocked right now (server config).';
		case 409:
			return 'An account with this email already exists.';
		case 429:
			return 'Too many attempts. Wait a bit and try again.';
		default:
			return 'Request failed. Please try again.';
	}
}

export async function signUp(input: JoinRequest): Promise<JoinResponse> {
	const email = safeEmail(input.email);
	const password = input.password ?? '';

	if (!email) {
		return { success: false, error: 'Email is required.', code: 'EMAIL_REQUIRED', status: 400 };
	}
	if (!password) {
		return { success: false, error: 'Password is required.', code: 'PASSWORD_REQUIRED', status: 400 };
	}


	const res = await apiFetch('/api/join', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password } satisfies JoinRequest)
	});

    console.log("res.status:", res.status);

	let data: any = null;
	try {
		data = await res.json();
	} catch {
		data = null;
	}


	if (!res.ok) {
		return {
			success: false,
			status: res.status,
			code: data?.code,
			error: data?.message || data?.error || fallbackMessage(res.status)
		};
	}

	return { success: true, message: data?.message || 'Account created.' };
}
