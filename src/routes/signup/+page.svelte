<script lang="ts">
	import { signUp } from "$src/lib/api/join";

	let email = $state('');
	let password = $state('');
	let signingUp = $state(false);
	let signUpError: string | null = $state(null);
	let signUpSuccess: string | null = $state(null);

	async function handleSignUpClick() {
		if (signingUp) return;

		signUpError = null;
		signUpSuccess = null;

		signingUp = true;
		try {
			const response = await signUp({ email, password });

			if (!response.success) {
				signUpError = response.code ? `[${response.code}] ${response.error}` : response.error;
				return;
			}

			signUpSuccess = response.message ?? 'Account created. You can now sign in.';
		} catch (error) {
			console.error('Sign up failed:', error);
			signUpError = 'Sign up failed. Please try again.';
		} finally {
			signingUp = false;
		}
	}
</script>

<div class="flex justify-center items-center">
	<div class="flex flex-col justify-center items-center bg-blue-200 border-2 border-blue-500 w-2xl rounded-2xl p-4">
		<div class="max-w-2xl w-full flex justify-center items-center">
			<input
				type="email"
				placeholder="Email"
				class="m-2 p-2 rounded-lg bg-gray-50 w-full"
				bind:value={email}
				autocomplete="email"
				inputmode="email"
			/>
		</div>

		<div class="max-w-2xl w-full flex justify-center items-center">
			<input
				type="password"
				placeholder="Password"
				class="m-2 p-2 rounded-lg bg-gray-50 w-full"
				bind:value={password}
				autocomplete="new-password"
			/>
		</div>

		<button
			class="flex justify-center items-center px-2 border-2 border-blue-500 rounded-lg cursor-pointer hover:scale-105 transition duration-200 hover:bg-blue-300 disabled:opacity-60 disabled:cursor-not-allowed"
			on:click={handleSignUpClick}
			disabled={signingUp}
		>
			<span>{signingUp ? 'Creating…' : 'Sign Up'}</span>
		</button>

		{#if signUpError}
			<p class="mt-2 text-sm text-red-700">{signUpError}</p>
		{/if}
		{#if signUpSuccess}
			<p class="mt-2 text-sm text-green-800">{signUpSuccess}</p>
		{/if}
	</div>
</div>
