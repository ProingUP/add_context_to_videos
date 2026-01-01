import type { UserState } from '$src/lib/types/user';

export let userState = <UserState>($state(
    {
        user: null,
        userDocData: null,
    }
));

