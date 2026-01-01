<script lang="ts">
	import { signInWithEmail } from "$src/lib/client/auth/login";
	import { userState } from "$lib/state/user.svelte";

	let email = "";
	let password = "";
	let loggingIn = false;
	let errorMsg: string | null = null;

	async function handleLoginClick() {
		if (loggingIn) return;

		errorMsg = null;
		loggingIn = true;

		try {
			const res = await signInWithEmail(email.trim().toLowerCase(), password);

			if (!res.success) {
				// your function returns error.code (often like "invalid_login_credentials")
				errorMsg = res.error || "Login failed.";
				return;
			}

			// store user in your state (adjust if your state shape differs)
			// userState.user = res.data.user;

			window.location.href = "/main"; // or wherever
		} catch (e) {
			console.error(e);
			errorMsg = "Login failed. Please try again.";
		} finally {
			loggingIn = false;
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
				autocomplete="current-password"
			/>
		</div>

		<button
			type="button"
			class="flex justify-center items-center px-2 border-2 border-blue-500 rounded-lg cursor-pointer hover:scale-105 transition duration-200 hover:bg-blue-300 disabled:opacity-60 disabled:cursor-not-allowed"
			on:click={handleLoginClick}
			disabled={loggingIn}
		>
			<span>{loggingIn ? "Logging in…" : "Login"}</span>
		</button>

		{#if errorMsg}
			<p class="mt-2 text-sm text-red-700">{errorMsg}</p>
		{/if}
	</div>
</div>
