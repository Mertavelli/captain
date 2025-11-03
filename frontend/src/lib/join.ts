import { createCallWithThreadAndOrganizer } from './graphHelper';

async function main() {
    try {
        const threadId = "19%3ameeting_ZDA5ZTA1NzctMjE0YS00NjIxLTk0ZGMtZmRlYzcwZmI1YWVm%40thread.v2";
        const organizerUserId = "bdd48c73-01f0-478c-9f41-45b5a474d5e9";
        const organizerDisplayName = "Louis";

        if (!threadId || !organizerUserId) {
            throw new Error('threadId oder organizerUserId fehlt. Bitte in .env setzen.');
        }

        console.log('Starte Call-Join für Thread:', threadId);

        const call = await createCallWithThreadAndOrganizer({
            threadId,
            organizerUserId,
            organizerDisplayName,
        });

        console.log('Call erfolgreich erstellt:', JSON.stringify(call, null, 2));
    } catch (err) {
        console.error('Fehler beim Call-Join:', err);
        process.exit(1);
    }
}

main();

// https://teams.microsoft.com/l/meetup-join/19%3ameeting_ZDA5ZTA1NzctMjE0YS00NjIxLTk0ZGMtZmRlYzcwZmI1YWVm%40thread.v2/0?context=%7b%22Tid%22%3a%22ae54bbda-9e02-42f8-805e-0a685c03f8c1%22%2c%22Oid%22%3a%22bdd48c73-01f0-478c-9f41-45b5a474d5e9%22%7d