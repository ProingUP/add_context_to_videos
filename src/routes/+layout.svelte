<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Nav from '$lib/components/Nav.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { supabaseClient } from '$src/lib/supabaseClient';
	import { onMount } from 'svelte';
	import { userState } from '$src/lib/state/user.svelte.js';
	import { goto, invalidate } from '$app/navigation';

	let {
		data,
		children
	} = $props();

	let { session } = $derived(data)

	userState.user = data?.user || null;


	onMount(() => {
		const { data: dataOnAuthStateChange } = supabaseClient.auth.onAuthStateChange(async (event, newSession) => {
			if (newSession?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth')
			}
			setTimeout(async () => {    // need to await on other Supabase functions here
				// This runs right after the callback has finished (without the setTimeout, after page refreshes, the user was unable to logout -- supabase.auth.signOut() and functions using supabase to get the session would hang forever)
				if (event === 'SIGNED_OUT') {
					userState.user = null
					userState.userDocData = null
				} else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
					if (!userState.user) {
						userState.user = null
						userState.userDocData = null
						return;
					} 
					
				// }else if (event === 'INITIAL_SESSION'){

				} else if (event === 'PASSWORD_RECOVERY'){
					if (!newSession) {
						console.error('Auth session missing during PASSWORD_RECOVERY');
						return;
					}
			
					// ✅ Set the session explicitly, so Supabase client is ready
					await supabaseClient.auth.setSession({
						access_token: newSession.access_token,
						refresh_token: newSession.refresh_token
					});
			
				} else if (event === 'USER_UPDATED'){

				}
			}, 0)
		});
	});


	
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<Nav />

<div class='min-h-[90vh]'>
	{@render children()}
</div>

<Footer />