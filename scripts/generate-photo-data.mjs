// filepath: scripts/generate-photo-data.mjs
import fs from 'fs';
import path from 'path';
import ExifReader from 'exifreader';
import fg from 'fast-glob';

const PHOTOS_DIR = path.join(process.cwd(), 'static/photos');
const OUTPUT_FILE = path.join(PHOTOS_DIR, 'photos.json');

function getField(tags, ...fields) {
	for (const f of fields) {
		if (tags?.[f]?.description) return tags[f].description;
		if (tags?.[f]?.value) return tags[f].value;
	}
	return null;
}

function getGPS(tags) {
	const lat = tags?.exif?.GPSLatitude?.description;
	const lon = tags?.exif?.GPSLongitude?.description;
	if (lat && lon) return { lat: Number(lat), lon: -Math.abs(Number(lon)) }; // West is negative
	return null;
}

async function getExif(filePath) {
	try {
		const buffer = fs.readFileSync(filePath);
		const tags = ExifReader.load(buffer, { expanded: true });
		return tags;
	} catch {
		return {};
	}
}

async function main() {
	const entries = await fg(['**/*.{jpg,jpeg,png,JPG,JPEG,PNG}'], { cwd: PHOTOS_DIR });
	const sections = {};

	for (const entry of entries) {
		const parts = entry.split('/'); // <-- Always split on '/'
		const filename = parts.pop();
		const section = parts.length > 0 ? parts.join('/') : 'Uncategorized';
		const absPath = path.join(PHOTOS_DIR, entry);
		const tags = await getExif(absPath);

		const exif = tags.exif || {};
		const camera = getField(exif, 'Model');
		const lens = getField(exif, 'LensModel');
		const focalLength = getField(exif, 'FocalLength');
		const aperture = getField(exif, 'FNumber');
		const exposure = getField(exif, 'ExposureTime');
		const iso = getField(exif, 'ISOSpeedRatings');
		const date = getField(exif, 'DateTimeOriginal', 'DateTime');
		const gps = getGPS(tags);

		// Infer subject from section (e.g., wildlife/bugs => 'bugs')
		let subject = null;
		if (section.includes('/')) {
			subject = section.split('/').pop();
		} else {
			subject = section;
		}

		if (!sections[section]) sections[section] = [];
		sections[section].push({
			src: `/photos/${entry.replace(/\\/g, '/')}`,
			filename,
			title:
				getField(tags, 'ImageDescription') ||
				filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
			date,
			camera,
			lens,
			focalLength,
			aperture,
			exposure,
			iso,
			gps,
			subject // <-- add this line
		});
	}

	const gallery = Object.entries(sections).map(([section, photos]) => ({
		section,
		photos
	}));

	fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
	fs.writeFileSync(OUTPUT_FILE, JSON.stringify(gallery, null, 2));
	console.log(`Gallery data written to ${OUTPUT_FILE}`);
}

main();
