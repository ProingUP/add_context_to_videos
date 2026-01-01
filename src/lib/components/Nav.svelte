<script lang="ts">
	import { userState } from "../state/user.svelte";
	import { logout } from "$lib/client/auth/logout";

	let signingOut = false;

	async function handleSignOut() {
		if (signingOut) return;
		signingOut = true;

		try {
			await logout();

			// clear your local user state (important for UI)
			userState.user = null;

			// optional: redirect
			window.location.href = "/login";
		} catch (e) {
			console.error("Error signing out:", e);
		} finally {
			signingOut = false;
		}
	}
</script>

<div>
	<nav class="navbar flex justify-end p-2">
		{#if !userState.user}
			<div class="nav-right flex gap-5">
				<a href="/login" class="nav-item hover:scale-105 transition duration-200">Login</a>
				<a
					href="/signup"
					class="nav-item bg-blue-200 border-2 hover:bg-blue-400 border-blue-500 px-2 rounded-lg hover:scale-105 transition duration-200"
				>
					Sign Up
				</a>
			</div>
		{:else}
			<div class="nav-right flex gap-5">
				<button
					type="button"
					class="nav-item hover:scale-105 transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
					on:click={handleSignOut}
					disabled={signingOut}
				>
					{signingOut ? "Signing out…" : "Sign Out"}
				</button>
			</div>
		{/if}
	</nav>
</div>
