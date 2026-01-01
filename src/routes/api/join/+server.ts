import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';

function normalizeEmail(raw: unknown): string {
	return String(raw ?? '').trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function err(status: number, code: string, message: string) {
	return json({ success: false, code, message }, { status });
}

function isStrongEnoughPassword(pw: string): boolean {
	// MVP rules; adjust if you want
	return typeof pw === 'string' && pw.length >= 8;
}

export async function POST({ request, locals }: RequestEvent) {
	try {        
		const body = await request.json().catch(() => ({}));
		const email = normalizeEmail(body?.email);
		const password = String(body?.password ?? '');

		if (!email) return err(400, 'EMAIL_REQUIRED', 'Please enter your email.');
		if (!isValidEmail(email)) return err(400, 'EMAIL_INVALID', 'Please enter a valid email address.');
		if (!password) return err(400, 'PASSWORD_REQUIRED', 'Please enter a password.');
		if (!isStrongEnoughPassword(password))
			return err(400, 'PASSWORD_WEAK', 'Password must be at least 8 characters.');

		// Create user with service role (server-side only)
		const { data, error } = await supabaseAdmin.auth.admin.createUser({
			email,
			password,
			email_confirm: true // <-- set to false if you want email verification
		});

		if (error) {
			const msg = (error.message || '').toLowerCase();

			// Common duplicate user message patterns
			if (msg.includes('already') || msg.includes('exists') || msg.includes('duplicate')) {
				return err(409, 'USER_EXISTS', 'An account with this email already exists.');
			}

            console.log("msg:", msg);
			if (msg.includes('forbidden') || msg.includes('not allowed') || msg.includes('not authorized')) {
				return err(403, 'SIGNUP_FORBIDDEN', 'Sign-up is currently blocked by server configuration.');
			}

			return err(400, 'SIGNUP_FAILED', error.message || 'Unable to create account.');
		}

		// Don't return sensitive details
		return json(
			{
				success: true,
				message: 'Account created. You can now sign in.'
			},
			{ status: 200 }
		);
	} catch (e) {
		console.error('POST /api/join error:', e);
		return err(500, 'SERVER_ERROR', 'Something went wrong on our side. Please try again.');
	}
}
