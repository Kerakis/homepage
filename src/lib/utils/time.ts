export function formatRelativeTime(timestamp: string | number | Date): string {
	const date = new Date(timestamp);
	const now = new Date();
	const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
	const minutes = Math.round(seconds / 60);
	const hours = Math.round(minutes / 60);
	const days = Math.round(hours / 24);

	if (seconds < 60) return `${seconds} sec ago`;
	if (minutes < 60) return `${minutes} min ago`;
	if (hours < 24) return `${hours} hr ago`;
	if (days === 1) return `Yesterday`;
	if (days < 7) return `${days} days ago`;

	return date.toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}
