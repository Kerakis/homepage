import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import ExifReader from 'exifreader';
import fg from 'fast-glob';
import sharp from 'sharp';

// Attempt to disable sharp's cache, which might help with file locking issues in some cases.
sharp.cache(false);

const PHOTOS_DIR = path.join(process.cwd(), 'static/photos');
const THUMBNAILS_DIR = path.join(process.cwd(), 'static/photos_thumbnails');
const OUTPUT_FILE = path.join(PHOTOS_DIR, 'photos.json');

const THUMBNAIL_WIDTH = 600;
const MAX_LONG_EDGE = 1800;

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
	if (lat && lon) return { lat: Number(lat), lon: -Math.abs(Number(lon)) };
	return null;
}

async function getExif(filePath) {
	try {
		const buffer = await fsp.readFile(filePath);
		const tags = ExifReader.load(buffer, { expanded: true });
		return tags;
	} catch (err) {
		console.error(`  Error reading EXIF for ${filePath}:`, err);
		return {};
	}
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper function to retry unlink operation with more patience
async function retryUnlink(filePath, maxRetries = 5, retryDelayMs = 500) {
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			await fsp.unlink(filePath);
			return true;
		} catch (err) {
			if (err.code === 'EPERM' && attempt < maxRetries) {
				console.warn(
					`  Unlink attempt ${attempt} for ${filePath} failed (EPERM). Retrying in ${retryDelayMs}ms...`
				);
				await delay(retryDelayMs * attempt);
			} else {
				throw err;
			}
		}
	}
	return false;
}

function cleanFilenameForTitle(filename) {
	// Remove file extension and replace underscores with spaces
	let cleaned = path.parse(filename).name.replace(/_/g, ' ');

	// Remove trailing numbers (like "Black-Bellied Whistling Ducks2" -> "Black-Bellied Whistling Ducks")
	cleaned = cleaned.replace(/\d+$/, '').trim();

	return cleaned;
}

async function main() {
	const entries = await fg(['**/*.{jpg,jpeg,png,JPG,JPEG,PNG}'], { cwd: PHOTOS_DIR, dot: false });

	// Load existing gallery data if it exists
	let existingGallery = [];
	if (fs.existsSync(OUTPUT_FILE)) {
		try {
			const existingData = fs.readFileSync(OUTPUT_FILE, 'utf8');
			existingGallery = JSON.parse(existingData);
			console.log(`Loaded existing gallery data with ${existingGallery.length} sections.`);
		} catch (err) {
			console.warn(`Failed to load existing gallery data: ${err.message}`);
		}
	}

	// Convert existing gallery to sections object for easier manipulation
	const sections = {};
	for (const gallerySection of existingGallery) {
		sections[gallerySection.section] = gallerySection.photos || [];
	}

	console.log(`Found ${entries.length} source images to process.`);

	// Process new images only
	for (const entry of entries) {
		const parts = entry.split('/');
		const originalFilenameWithExt = parts.pop();
		const originalBaseName = path.parse(originalFilenameWithExt).name;
		const sectionPathParts = [...parts];
		const section = parts.length > 0 ? parts.join('/') : 'Uncategorized';
		const absPathToOriginal = path.join(PHOTOS_DIR, entry);

		// Check if this photo already exists in the gallery data
		const expectedWebPName = `${originalBaseName}.webp`;
		const expectedWebPPath = `/photos/${path.join(...sectionPathParts, expectedWebPName).replace(/\\/g, '/')}`;

		if (sections[section]?.some((photo) => photo.src === expectedWebPPath)) {
			console.log(`  Skipping ${originalFilenameWithExt} - already exists in gallery data.`);
			continue;
		}

		console.log(`Processing: ${absPathToOriginal}`);

		let tags;
		try {
			tags = await getExif(absPathToOriginal);
		} catch (exifError) {
			console.error(
				`  Failed to get EXIF for ${absPathToOriginal}, skipping file. Error: ${exifError}`
			);
			continue;
		}

		const thumbnailWebPName = `${originalBaseName}_thumb.webp`;
		const thumbnailRelativePath = path.join(...sectionPathParts, thumbnailWebPName);
		const thumbnailAbsolutePath = path.join(THUMBNAILS_DIR, thumbnailRelativePath);
		const thumbnailWebPath = `/photos_thumbnails/${thumbnailRelativePath.replace(/\\/g, '/')}`;

		try {
			fs.mkdirSync(path.dirname(thumbnailAbsolutePath), { recursive: true });
			await sharp(absPathToOriginal)
				.resize({ width: THUMBNAIL_WIDTH })
				.webp({ lossless: true })
				.toFile(thumbnailAbsolutePath);
			console.log(`  Generated lossless WebP thumbnail: ${thumbnailAbsolutePath}`);
		} catch (err) {
			console.error(`  Error generating thumbnail for ${absPathToOriginal}:`, err);
			continue;
		}

		const fullWebPName = `${originalBaseName}.webp`;
		const fullWebPRelativePath = path.join(...sectionPathParts, fullWebPName);
		const fullWebPAbsolutePath = path.join(PHOTOS_DIR, fullWebPRelativePath);
		const fullWebPWebPath = `/photos/${fullWebPRelativePath.replace(/\\/g, '/')}`;

		let fullConversionSuccess = false;
		try {
			await sharp(absPathToOriginal)
				.resize({
					width: MAX_LONG_EDGE,
					height: MAX_LONG_EDGE,
					fit: 'inside',
					withoutEnlargement: true
				})
				.webp({ lossless: true })
				.keepExif()
				.toFile(fullWebPAbsolutePath);
			console.log(`  Generated lossless WebP: ${fullWebPAbsolutePath}`);
			fullConversionSuccess = true;
		} catch (err) {
			console.error(`  Error generating lossless WebP for ${absPathToOriginal}:`, err);
		}

		if (fullConversionSuccess) {
			try {
				await retryUnlink(absPathToOriginal);
				console.log(`  Deleted original: ${absPathToOriginal}`);
			} catch (err) {
				console.error(
					`  Failed to delete original file ${absPathToOriginal} after multiple retries:`,
					err
				);
				console.warn(
					`  Skipping ${originalFilenameWithExt} from photos.json due to FAILED DELETION of original.`
				);
				continue;
			}
		} else {
			console.warn(
				`  Skipping ${originalFilenameWithExt} from photos.json due to FAILED FULL WEBP CONVERSION.`
			);
			continue;
		}

		const exif = tags.exif || {};
		const camera = getField(exif, 'Model');
		const lens = getField(exif, 'LensModel');
		const focalLength = getField(exif, 'FocalLength');
		const aperture = getField(exif, 'FNumber');
		const exposure = getField(exif, 'ExposureTime');
		const iso = getField(exif, 'ISOSpeedRatings');
		const date = getField(exif, 'DateTimeOriginal', 'DateTime');
		const gps = getGPS(tags);
		let subject = null;
		if (section.includes('/')) {
			// Clean the subject name by removing trailing numbers
			const rawSubject = section.split('/').pop();
			subject = rawSubject ? cleanFilenameForTitle(rawSubject) : null;
		} else {
			subject = cleanFilenameForTitle(section);
		}

		if (!sections[section]) sections[section] = [];
		sections[section].push({
			src: fullWebPWebPath,
			thumbnailSrc: thumbnailWebPath,
			filename: fullWebPName,
			title: getField(tags, 'ImageDescription') || cleanFilenameForTitle(originalFilenameWithExt),
			date,
			camera,
			lens,
			focalLength,
			aperture,
			exposure,
			iso,
			gps,
			subject
		});
	}

	const gallery = Object.entries(sections).map(([sectionName, photos]) => ({
		section: sectionName,
		photos
	}));

	const outputDir = path.dirname(OUTPUT_FILE);
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}
	fs.writeFileSync(OUTPUT_FILE, JSON.stringify(gallery, null, 2));
	console.log(`Gallery data written to ${OUTPUT_FILE}`);
	console.log('Processing complete.');
}

main().catch(console.error);
