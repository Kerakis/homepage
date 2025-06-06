import fs from 'fs'; // Keep fs for existsSync and writeFileSync if preferred for sync operations
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
	// Increased retries and delay
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			await fsp.unlink(filePath);
			return true; // Unlink successful
		} catch (err) {
			if (err.code === 'EPERM' && attempt < maxRetries) {
				console.warn(
					`  Unlink attempt ${attempt} for ${filePath} failed (EPERM). Retrying in ${retryDelayMs}ms...`
				);
				await delay(retryDelayMs * attempt); // Increase delay for subsequent retries
			} else {
				throw err; // Rethrow error if it's not EPERM or if max retries reached
			}
		}
	}
	return false;
}

async function main() {
	const entries = await fg(['**/*.{jpg,jpeg,png,JPG,JPEG,PNG}'], { cwd: PHOTOS_DIR, dot: false });

	// Also scan for existing WebP files that might be missing from photos.json
	const existingWebPFiles = await fg(['**/*.webp'], { cwd: PHOTOS_DIR, dot: false });
	const existingThumbnails = await fg(['**/*.webp'], { cwd: THUMBNAILS_DIR, dot: false });

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

	// Create a set of expected WebP files based on source images
	const expectedWebPFiles = new Set();
	const expectedThumbnails = new Set();

	for (const entry of entries) {
		const parts = entry.split('/');
		const originalFilenameWithExt = parts.pop();
		const originalBaseName = path.parse(originalFilenameWithExt).name;
		const sectionPathParts = [...parts];

		// Expected WebP and thumbnail paths
		const expectedWebPName = `${originalBaseName}.webp`;
		const expectedThumbnailName = `${originalBaseName}_thumb.webp`;
		const expectedWebPPath = path.join(...sectionPathParts, expectedWebPName);
		const expectedThumbnailPath = path.join(...sectionPathParts, expectedThumbnailName);

		expectedWebPFiles.add(expectedWebPPath.replace(/\\/g, '/'));
		expectedThumbnails.add(expectedThumbnailPath.replace(/\\/g, '/'));
	}

	// Clean up orphaned WebP files
	console.log('Cleaning up orphaned WebP files...');
	for (const webpFile of existingWebPFiles) {
		const normalizedPath = webpFile.replace(/\\/g, '/');
		if (!normalizedPath.endsWith('_thumb.webp') && !expectedWebPFiles.has(normalizedPath)) {
			const fullPath = path.join(PHOTOS_DIR, webpFile);
			try {
				await fsp.unlink(fullPath);
				console.log(`  Removed orphaned WebP: ${fullPath}`);
			} catch (err) {
				console.error(`  Failed to remove orphaned WebP ${fullPath}:`, err.message);
			}
		}
	}

	// Clean up orphaned thumbnails
	console.log('Cleaning up orphaned thumbnails...');
	for (const thumbFile of existingThumbnails) {
		const normalizedPath = thumbFile.replace(/\\/g, '/');
		if (!expectedThumbnails.has(normalizedPath)) {
			const fullPath = path.join(THUMBNAILS_DIR, thumbFile);
			try {
				await fsp.unlink(fullPath);
				console.log(`  Removed orphaned thumbnail: ${fullPath}`);
			} catch (err) {
				console.error(`  Failed to remove orphaned thumbnail ${fullPath}:`, err.message);
			}
		}
	}

	// Clean up orphaned entries from gallery data - BE MORE CAREFUL HERE
	console.log('Cleaning up orphaned gallery entries...');
	for (const [sectionName, photos] of Object.entries(sections)) {
		const validPhotos = photos.filter((photo) => {
			if (!photo.src) return false;

			// Extract the WebP path from photo.src (remove /photos/ prefix)
			const webpRelativePath = photo.src.replace(/^\/photos\//, '');

			// Check if this WebP file actually exists in our existingWebPFiles list
			const webpExists = existingWebPFiles.some(
				(existingFile) => existingFile.replace(/\\/g, '/') === webpRelativePath
			);

			// Also check if there's a corresponding source file
			const hasSourceFile = entries.some((entry) => {
				const entryBaseName = path.parse(entry).name;
				const photoBaseName = path.parse(webpRelativePath).name;
				return entryBaseName === photoBaseName;
			});

			// Keep the photo if either the WebP exists OR there's a source file
			if (!webpExists && !hasSourceFile) {
				console.log(`  Removing gallery entry for missing file: ${photo.src}`);
				return false;
			}
			return true;
		});

		if (validPhotos.length !== photos.length) {
			sections[sectionName] = validPhotos;
		}

		// Remove empty sections
		if (validPhotos.length === 0) {
			delete sections[sectionName];
			console.log(`  Removed empty section: ${sectionName}`);
		}
	}

	// Check for existing WebP files that are missing from photos.json
	console.log(`Checking ${existingWebPFiles.length} existing WebP files for orphans...`);
	for (const webpEntry of existingWebPFiles) {
		const parts = webpEntry.split('/');
		const webpFilename = parts.pop();
		const baseName = path.parse(webpFilename).name;
		const sectionPathParts = [...parts];
		const section = parts.length > 0 ? parts.join('/') : 'Uncategorized';
		const webpPath = `/photos/${webpEntry.replace(/\\/g, '/')}`;
		const absPathToWebP = path.join(PHOTOS_DIR, webpEntry);

		// Skip thumbnails (they end with _thumb)
		if (baseName.endsWith('_thumb')) continue;

		// First, check if the WebP file actually exists on disk
		if (!fs.existsSync(absPathToWebP)) {
			console.log(`  WebP file referenced but missing on disk: ${absPathToWebP} - skipping`);
			continue;
		}

		// Check if this WebP file is already in the gallery data
		const existsInGallery = sections[section]?.some((photo) => photo.src === webpPath);

		if (!existsInGallery) {
			console.log(`Found orphaned WebP file: ${webpEntry} - adding to gallery data`);

			// Try to get EXIF data from the WebP file
			let tags = {};
			try {
				tags = await getExif(absPathToWebP);
			} catch (exifError) {
				console.warn(`  Could not read EXIF from WebP file ${absPathToWebP}: ${exifError.message}`);
			}

			// Check if thumbnail exists
			const thumbnailWebPName = `${baseName}_thumb.webp`;
			const thumbnailRelativePath = path.join(...sectionPathParts, thumbnailWebPName);
			const thumbnailAbsolutePath = path.join(THUMBNAILS_DIR, thumbnailRelativePath);
			const thumbnailWebPath = `/photos_thumbnails/${thumbnailRelativePath.replace(/\\/g, '/')}`;

			// Create thumbnail if it doesn't exist
			if (!fs.existsSync(thumbnailAbsolutePath)) {
				try {
					fs.mkdirSync(path.dirname(thumbnailAbsolutePath), { recursive: true });
					await sharp(absPathToWebP)
						.resize({ width: THUMBNAIL_WIDTH })
						.webp({ lossless: true })
						.toFile(thumbnailAbsolutePath);
					console.log(`  Generated missing thumbnail: ${thumbnailAbsolutePath}`);
				} catch (err) {
					console.error(`  Error generating thumbnail for ${absPathToWebP}:`, err);
					continue;
				}
			}

			const exif = tags.exif || {};
			const camera = getField(exif, 'Model') || null;
			const lens = getField(exif, 'LensModel') || null;
			const focalLength = getField(exif, 'FocalLength') || null;
			const aperture = getField(exif, 'FNumber') || null;
			const exposure = getField(exif, 'ExposureTime') || null;
			const iso = getField(exif, 'ISOSpeedRatings') || null;
			const date = getField(exif, 'DateTimeOriginal', 'DateTime') || null;
			const gps = getGPS(tags) || null;
			let subject = null;
			if (section.includes('/')) {
				subject = section.split('/').pop();
			} else {
				subject = section;
			}

			if (!sections[section]) sections[section] = [];
			sections[section].push({
				src: webpPath,
				thumbnailSrc: thumbnailWebPath,
				filename: webpFilename,
				title: getField(tags, 'ImageDescription') || baseName.replace(/_/g, ' '),
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
	}

	console.log(`Found ${entries.length} source images to process.`);

	// Continue with existing logic for processing new images...
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
				.webp({ lossless: true }) // Generate lossless WebP thumbnails
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
			subject = section.split('/').pop();
		} else {
			subject = section;
		}

		if (!sections[section]) sections[section] = [];
		sections[section].push({
			src: fullWebPWebPath,
			thumbnailSrc: thumbnailWebPath,
			filename: fullWebPName,
			title: getField(tags, 'ImageDescription') || originalBaseName.replace(/_/g, ' '),
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
