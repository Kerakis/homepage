import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import ExifReader from 'exifreader';
import fg from 'fast-glob';
import sharp from 'sharp';
import readline from 'readline';

// Attempt to disable sharp's cache, which might help with file locking issues in some cases.
sharp.cache(false);

const PHOTOS_DIR = path.join(process.cwd(), 'static/photos');
const THUMBNAILS_DIR = path.join(process.cwd(), 'static/photos_thumbnails');
const OUTPUT_FILE = path.join(PHOTOS_DIR, 'photos.json');
const LOG_FILE = path.join(process.cwd(), 'photo-processing.log');

const THUMBNAIL_WIDTH = 600;
const MAX_LONG_EDGE = 1800;

// Setup readline interface
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

// Helper function to prompt user input
function prompt(question) {
	return new Promise((resolve) => {
		rl.question(question, resolve);
	});
}

// Logging function
function log(message, isError = false) {
	const timestamp = new Date().toISOString();
	const prefix = isError ? 'ERROR' : 'INFO';
	const logMessage = `${timestamp} - [${prefix}] ${message}`;

	if (isError) {
		console.error(logMessage);
	} else {
		console.log(logMessage);
	}

	try {
		fs.appendFileSync(LOG_FILE, logMessage + '\n');
	} catch (err) {
		console.error(`Failed to write to log file: ${err.message}`);
	}
}

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
		log(`Error reading EXIF for ${filePath}: ${err.message}`, true);
		return {};
	}
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
	let cleaned = path.parse(filename).name.replace(/_/g, ' ');
	cleaned = cleaned.replace(/\d+$/, '').trim();
	return cleaned;
}

async function scanPhotosDirectory() {
	console.log('Scanning photos directory...');

	// Get all image files (original formats)
	const originalImages = await fg(['**/*.{jpg,jpeg,png,JPG,JPEG,PNG}'], {
		cwd: PHOTOS_DIR,
		dot: false
	});

	// Get all WebP files
	const webpImages = await fg(['**/*.webp'], { cwd: PHOTOS_DIR, dot: false });

	// Load existing gallery data
	let existingGallery = [];
	if (fs.existsSync(OUTPUT_FILE)) {
		try {
			const existingData = fs.readFileSync(OUTPUT_FILE, 'utf8');
			existingGallery = JSON.parse(existingData);
		} catch (err) {
			log(`Failed to load existing gallery data: ${err.message}`, true);
		}
	}

	// Convert existing gallery to flat array of photo paths
	const existingPhotoPaths = new Set();
	for (const section of existingGallery) {
		for (const photo of section.photos || []) {
			existingPhotoPaths.add(photo.src);
		}
	}

	// Find new photos (original format images that need processing)
	const newPhotos = [];
	for (const entry of originalImages) {
		const parts = entry.split('/');
		const originalBaseName = path.parse(parts[parts.length - 1]).name;
		const sectionPathParts = parts.slice(0, -1);
		const expectedWebPPath = `/photos/${path.join(...sectionPathParts, `${originalBaseName}.webp`).replace(/\\/g, '/')}`;

		if (!existingPhotoPaths.has(expectedWebPPath)) {
			newPhotos.push(entry);
		}
	}

	// Find orphaned WebP files (WebP files without entries in photos.json)
	const orphanedWebPs = [];
	for (const entry of webpImages) {
		const webpPath = `/photos/${entry.replace(/\\/g, '/')}`;
		if (!existingPhotoPaths.has(webpPath)) {
			orphanedWebPs.push(entry);
		}
	}

	// Find missing photos (entries in photos.json without actual files)
	const missingPhotos = [];
	for (const section of existingGallery) {
		for (const photo of section.photos || []) {
			const relativePath = photo.src.replace('/photos/', '');
			const absolutePath = path.join(PHOTOS_DIR, relativePath);
			if (!fs.existsSync(absolutePath)) {
				missingPhotos.push({ section: section.section, photo });
			}
		}
	}

	const results = {
		newPhotos,
		orphanedWebPs,
		missingPhotos,
		existingGallery
	};

	// Always display scan results after scanning
	console.log('\nScan complete!');
	displayScanResults(results);

	return results;
}

// Helper function for pluralization
function pluralize(count, singular, plural = singular + 's') {
	return count === 1 ? singular : plural;
}

function displayScanResults(scanResults) {
	console.log('\n=== PHOTO DIRECTORY SCAN RESULTS ===');

	console.log(`\nNew photos (original format, need processing): ${scanResults.newPhotos.length}`);
	if (scanResults.newPhotos.length > 0) {
		scanResults.newPhotos.forEach((photo) => console.log(`  - ${photo}`));
	}

	console.log(`\nOrphaned WebP files (not in gallery data): ${scanResults.orphanedWebPs.length}`);
	if (scanResults.orphanedWebPs.length > 0) {
		scanResults.orphanedWebPs.forEach((photo) => console.log(`  - ${photo}`));
	}

	console.log(
		`\nMissing photos (in gallery data but file not found): ${scanResults.missingPhotos.length}`
	);
	if (scanResults.missingPhotos.length > 0) {
		scanResults.missingPhotos.forEach((missing) =>
			console.log(`  - ${missing.photo.filename} (section: ${missing.section})`)
		);
	}

	console.log(
		`\nExisting gallery ${pluralize(scanResults.existingGallery.length, 'section')}: ${scanResults.existingGallery.length}`
	);
	if (scanResults.existingGallery.length > 0) {
		scanResults.existingGallery.forEach((section) =>
			console.log(
				`  - ${section.section}: ${section.photos?.length || 0} ${pluralize(section.photos?.length || 0, 'photo')}`
			)
		);
	}

	console.log('\n=====================================\n');
}

async function processNewPhotos(newPhotos, existingGallery) {
	if (newPhotos.length === 0) {
		console.log('No new photos to process.');
		return false; // Return false to indicate no work was done
	}

	console.log(`\nProcessing ${newPhotos.length} new ${pluralize(newPhotos.length, 'photo')}...`);
	log(`Starting to process ${newPhotos.length} new ${pluralize(newPhotos.length, 'photo')}`);

	// Convert existing gallery to sections object
	const sections = {};
	for (const gallerySection of existingGallery) {
		sections[gallerySection.section] = gallerySection.photos || [];
	}

	for (const entry of newPhotos) {
		const parts = entry.split('/');
		const originalFilenameWithExt = parts.pop();
		const originalBaseName = path.parse(originalFilenameWithExt).name;
		const sectionPathParts = [...parts];
		const section = parts.length > 0 ? parts.join('/') : 'Uncategorized';
		const absPathToOriginal = path.join(PHOTOS_DIR, entry);

		console.log(`Processing: ${originalFilenameWithExt}`);

		let tags;
		try {
			tags = await getExif(absPathToOriginal);
		} catch (exifError) {
			log(`Failed to get EXIF for ${absPathToOriginal}, skipping file. Error: ${exifError}`, true);
			continue;
		}

		// Generate thumbnail
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
			console.log(`  Generated thumbnail: ${thumbnailWebPName}`);
		} catch (err) {
			log(`Error generating thumbnail for ${absPathToOriginal}: ${err.message}`, true);
			continue;
		}

		// Generate full-size WebP
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
			console.log(`  Generated WebP: ${fullWebPName}`);
			fullConversionSuccess = true;
		} catch (err) {
			log(`Error generating WebP for ${absPathToOriginal}: ${err.message}`, true);
		}

		if (fullConversionSuccess) {
			try {
				await retryUnlink(absPathToOriginal);
				console.log(`  Deleted original: ${originalFilenameWithExt}`);
				log(`Deleted original file: ${absPathToOriginal}`);
			} catch (err) {
				log(`Failed to delete original file ${absPathToOriginal}: ${err.message}`, true);
				continue;
			}
		} else {
			log(`Skipping ${originalFilenameWithExt} due to failed WebP conversion`, true);
			continue;
		}

		// Extract EXIF data
		const exif = tags.exif || {};
		const camera = getField(exif, 'Model');
		const lens = getField(exif, 'LensModel');
		const focalLength = getField(exif, 'FocalLength');
		const aperture = getField(exif, 'FNumber');
		const exposure = getField(exif, 'ExposureTime');
		const iso = getField(exif, 'ISOSpeedRatings');
		const date = getField(exif, 'DateTimeOriginal', 'DateTime');
		const gps = getGPS(tags);

		// Check for missing EXIF data
		const missingExifData = [];
		if (!camera) missingExifData.push('camera');
		if (!lens) missingExifData.push('lens');
		if (!focalLength) missingExifData.push('focalLength');
		if (!aperture) missingExifData.push('aperture');
		if (!exposure) missingExifData.push('exposure');
		if (!iso) missingExifData.push('iso');
		if (!date) missingExifData.push('date');
		if (!gps) missingExifData.push('GPS coordinates');

		if (missingExifData.length > 0) {
			const missingMessage = `Photo ${fullWebPName} is missing EXIF data: ${missingExifData.join(', ')}`;
			console.log(`  Warning: ${missingMessage}`);
			log(`Missing EXIF data - ${missingMessage}`);
		}

		let subject = null;
		if (section.includes('/')) {
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

		log(`Successfully processed and added photo: ${fullWebPName}`);
	}

	// Save updated gallery data
	const gallery = Object.entries(sections).map(([sectionName, photos]) => ({
		section: sectionName,
		photos
	}));

	const outputDir = path.dirname(OUTPUT_FILE);
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}
	fs.writeFileSync(OUTPUT_FILE, JSON.stringify(gallery, null, 2));
	console.log(`Gallery data updated in ${OUTPUT_FILE}`);
	log(`Gallery data updated with ${newPhotos.length} new ${pluralize(newPhotos.length, 'photo')}`);
	return true; // Return true to indicate work was done
}

async function addOrphanedPhotos(orphanedWebPs, existingGallery) {
	if (orphanedWebPs.length === 0) {
		console.log('No orphaned WebP files found.');
		return false; // Return false to indicate no work was done
	}

	console.log(
		`\nAdding ${orphanedWebPs.length} orphaned WebP ${pluralize(orphanedWebPs.length, 'file')} to gallery...`
	);
	log(
		`Starting to add ${orphanedWebPs.length} orphaned WebP ${pluralize(orphanedWebPs.length, 'file')}`
	);

	// Convert existing gallery to sections object
	const sections = {};
	for (const gallerySection of existingGallery) {
		sections[gallerySection.section] = gallerySection.photos || [];
	}

	for (const entry of orphanedWebPs) {
		const parts = entry.split('/');
		const webpFilename = parts.pop();
		const baseName = path.parse(webpFilename).name;
		const sectionPathParts = [...parts];
		const section = parts.length > 0 ? parts.join('/') : 'Uncategorized';
		const absPathToWebP = path.join(PHOTOS_DIR, entry);

		console.log(`Adding orphaned photo: ${webpFilename}`);

		// Try to get EXIF from WebP file
		let tags;
		try {
			tags = await getExif(absPathToWebP);
		} catch (exifError) {
			log(`Failed to get EXIF for orphaned WebP ${absPathToWebP}: ${exifError}`, true);
			tags = {};
		}

		// Look for corresponding thumbnail
		const thumbnailWebPName = `${baseName}_thumb.webp`;
		const thumbnailRelativePath = path.join(...sectionPathParts, thumbnailWebPName);
		const thumbnailAbsolutePath = path.join(THUMBNAILS_DIR, thumbnailRelativePath);
		const thumbnailWebPath = `/photos_thumbnails/${thumbnailRelativePath.replace(/\\/g, '/')}`;

		// If thumbnail doesn't exist, try to generate it
		if (!fs.existsSync(thumbnailAbsolutePath)) {
			try {
				fs.mkdirSync(path.dirname(thumbnailAbsolutePath), { recursive: true });
				await sharp(absPathToWebP)
					.resize({ width: THUMBNAIL_WIDTH })
					.webp({ lossless: true })
					.toFile(thumbnailAbsolutePath);
				console.log(`  Generated missing thumbnail: ${thumbnailWebPName}`);
			} catch (err) {
				log(`Error generating thumbnail for orphaned WebP ${absPathToWebP}: ${err.message}`, true);
			}
		}

		// Extract EXIF data
		const exif = tags.exif || {};
		const camera = getField(exif, 'Model');
		const lens = getField(exif, 'LensModel');
		const focalLength = getField(exif, 'FocalLength');
		const aperture = getField(exif, 'FNumber');
		const exposure = getField(exif, 'ExposureTime');
		const iso = getField(exif, 'ISOSpeedRatings');
		const date = getField(exif, 'DateTimeOriginal', 'DateTime');
		const gps = getGPS(tags);

		// Check for missing EXIF data
		const missingExifData = [];
		if (!camera) missingExifData.push('camera');
		if (!lens) missingExifData.push('lens');
		if (!focalLength) missingExifData.push('focalLength');
		if (!aperture) missingExifData.push('aperture');
		if (!exposure) missingExifData.push('exposure');
		if (!iso) missingExifData.push('iso');
		if (!date) missingExifData.push('date');
		if (!gps) missingExifData.push('GPS coordinates');

		if (missingExifData.length > 0) {
			const missingMessage = `Orphaned photo ${webpFilename} is missing EXIF data: ${missingExifData.join(', ')}`;
			console.log(`  Warning: ${missingMessage}`);
			log(`Missing EXIF data - ${missingMessage}`);
		}

		let subject = null;
		if (section.includes('/')) {
			const rawSubject = section.split('/').pop();
			subject = rawSubject ? cleanFilenameForTitle(rawSubject) : null;
		} else {
			subject = cleanFilenameForTitle(section);
		}

		const fullWebPWebPath = `/photos/${entry.replace(/\\/g, '/')}`;

		if (!sections[section]) sections[section] = [];
		sections[section].push({
			src: fullWebPWebPath,
			thumbnailSrc: thumbnailWebPath,
			filename: webpFilename,
			title: getField(tags, 'ImageDescription') || cleanFilenameForTitle(webpFilename),
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

		log(`Successfully added orphaned photo: ${webpFilename}`);
	}

	// Save updated gallery data
	const gallery = Object.entries(sections).map(([sectionName, photos]) => ({
		section: sectionName,
		photos
	}));

	fs.writeFileSync(OUTPUT_FILE, JSON.stringify(gallery, null, 2));
	console.log(`Gallery data updated with orphaned photos`);
	log(
		`Gallery data updated with ${orphanedWebPs.length} orphaned ${pluralize(orphanedWebPs.length, 'photo')}`
	);
	return true; // Return true to indicate work was done
}

async function removeMissingPhotos(missingPhotos, existingGallery) {
	if (missingPhotos.length === 0) {
		console.log('No missing photos found in gallery data.');
		return false; // Return false to indicate no work was done
	}

	console.log(
		`\nRemoving ${missingPhotos.length} missing ${pluralize(missingPhotos.length, 'photo')} from gallery data...`
	);
	log(
		`Starting to remove ${missingPhotos.length} missing ${pluralize(missingPhotos.length, 'photo')} from gallery data`
	);

	// Convert existing gallery to sections object
	const sections = {};
	for (const gallerySection of existingGallery) {
		sections[gallerySection.section] = gallerySection.photos || [];
	}

	for (const missing of missingPhotos) {
		const { section, photo } = missing;
		console.log(`Removing missing photo: ${photo.filename} from section: ${section}`);

		// Remove from sections object
		if (sections[section]) {
			sections[section] = sections[section].filter((p) => p.src !== photo.src);
			log(`Removed missing photo from gallery data: ${photo.filename}`);
		}
	}

	// Save updated gallery data
	const gallery = Object.entries(sections)
		.filter(([, photos]) => photos.length > 0) // Remove empty sections
		.map(([sectionName, photos]) => ({
			section: sectionName,
			photos
		}));

	fs.writeFileSync(OUTPUT_FILE, JSON.stringify(gallery, null, 2));
	console.log(`Gallery data updated - removed missing photos`);
	log(
		`Gallery data updated - removed ${missingPhotos.length} missing ${pluralize(missingPhotos.length, 'photo')}`
	);
	return true; // Return true to indicate work was done
}

async function deleteAllPhotosAndData() {
	console.log('\n⚠️  WARNING: This will delete ALL photos, thumbnails, and gallery data!');
	console.log('This action cannot be undone!');

	while (true) {
		const confirm1 = await prompt(
			'Are you absolutely sure you want to delete everything? (type "DELETE" to confirm, or "cancel" to abort): '
		);

		if (confirm1.toLowerCase() === 'cancel') {
			console.log('Operation cancelled.');
			return;
		}

		if (confirm1 !== 'DELETE') {
			console.log('Please type exactly "DELETE" to confirm, or "cancel" to abort.');
			continue;
		}

		break; // Exit the loop if they typed DELETE correctly
	}

	while (true) {
		const confirm2 = await prompt(
			'This will permanently delete all photos and data. Type "YES I AM SURE" to proceed, or "cancel" to abort: '
		);

		if (confirm2.toLowerCase() === 'cancel') {
			console.log('Operation cancelled.');
			return;
		}

		if (confirm2 !== 'YES I AM SURE') {
			console.log('Please type exactly "YES I AM SURE" to confirm, or "cancel" to abort.');
			continue;
		}

		break; // Exit the loop if they typed the confirmation correctly
	}

	console.log('\nDeleting all photos and data...');
	log('Starting complete deletion of all photos and data');

	try {
		// Delete all files in photos directory (but keep subdirectories)
		const allFiles = await fg(['**/*'], { cwd: PHOTOS_DIR, dot: false, onlyFiles: true });
		for (const file of allFiles) {
			const filePath = path.join(PHOTOS_DIR, file);
			await fsp.unlink(filePath);
		}
		console.log(
			`Deleted ${allFiles.length} ${pluralize(allFiles.length, 'file')} from photos directory`
		);
		log(`Deleted ${allFiles.length} ${pluralize(allFiles.length, 'file')} from photos directory`);

		// Delete all files in thumbnails directory
		if (fs.existsSync(THUMBNAILS_DIR)) {
			const allThumbnails = await fg(['**/*'], {
				cwd: THUMBNAILS_DIR,
				dot: false,
				onlyFiles: true
			});
			for (const file of allThumbnails) {
				const filePath = path.join(THUMBNAILS_DIR, file);
				await fsp.unlink(filePath);
			}
			console.log(
				`Deleted ${allThumbnails.length} thumbnail ${pluralize(allThumbnails.length, 'file')}`
			);
			log(`Deleted ${allThumbnails.length} thumbnail ${pluralize(allThumbnails.length, 'file')}`);
		}

		console.log('All photos and data have been deleted successfully.');
		log('Complete deletion operation completed successfully');
	} catch (err) {
		log(`Error during complete deletion: ${err.message}`, true);
		console.error('Error during deletion:', err.message);
	}
}

async function removePhoto(existingGallery, currentPath = '') {
	if (existingGallery.length === 0) {
		console.log('No photos found in gallery data.');
		return;
	}

	// Get sections at the current level
	const sectionsAtCurrentLevel = new Set();
	const sectionsWithPhotos = [];

	// Find all sections that start with current path
	for (const section of existingGallery) {
		if (section.photos && section.photos.length > 0) {
			const sectionPath = section.section;

			// If we're at root level, show top-level sections
			if (currentPath === '') {
				const topLevel = sectionPath.includes('/') ? sectionPath.split('/')[0] : sectionPath;
				sectionsAtCurrentLevel.add(topLevel);

				// If this section is exactly at the current level (no deeper nesting), add it
				if (!sectionPath.includes('/')) {
					sectionsWithPhotos.push(section);
				}
			} else {
				// If we're in a subfolder, show sections that start with current path
				if (sectionPath.startsWith(currentPath + '/')) {
					const remainingPath = sectionPath.substring(currentPath.length + 1);
					const nextLevel = remainingPath.includes('/')
						? remainingPath.split('/')[0]
						: remainingPath;
					sectionsAtCurrentLevel.add(currentPath + '/' + nextLevel);

					// If this section is exactly at the current level, add it
					if (!remainingPath.includes('/')) {
						sectionsWithPhotos.push(section);
					}
				} else if (sectionPath === currentPath) {
					// If this section is exactly the current path, add it
					sectionsWithPhotos.push(section);
				}
			}
		}
	}

	// Create menu items for folders and direct sections
	const menuItems = [];

	// Add sections that have photos directly at this level
	for (const section of sectionsWithPhotos) {
		menuItems.push({
			type: 'section',
			section: section,
			display: section.section,
			photoCount: section.photos.length
		});
	}

	// Add folders that have photos in subfolders
	for (const sectionPath of sectionsAtCurrentLevel) {
		// Skip if we already added it as a direct section
		const hasDirectPhotos = sectionsWithPhotos.some((s) => s.section === sectionPath);
		if (!hasDirectPhotos) {
			// Count total photos in all subfolders
			let totalPhotos = 0;
			for (const section of existingGallery) {
				if (section.section.startsWith(sectionPath + '/') || section.section === sectionPath) {
					totalPhotos += section.photos ? section.photos.length : 0;
				}
			}

			if (totalPhotos > 0) {
				menuItems.push({
					type: 'folder',
					path: sectionPath,
					display: sectionPath,
					photoCount: totalPhotos
				});
			}
		}
	}

	// Sort menu items
	menuItems.sort((a, b) => a.display.localeCompare(b.display));

	if (menuItems.length === 0) {
		console.log('No sections with photos found.');
		return;
	}

	// Display the menu
	const pathDisplay = currentPath === '' ? 'root' : currentPath;
	console.log(`\nSelect a section to remove photos from (${pathDisplay}):`);

	menuItems.forEach((item, index) => {
		console.log(
			`${index + 1}. ${item.display} (${item.photoCount} ${pluralize(item.photoCount, 'photo')})`
		);
	});

	// Add back option if we're not at root
	if (currentPath !== '') {
		console.log(`${menuItems.length + 1}. Go back`);
		console.log(`${menuItems.length + 2}. Cancel`);
	} else {
		console.log(`${menuItems.length + 1}. Cancel`);
	}

	const choice = await prompt('\nEnter your choice: ');
	const choiceIndex = parseInt(choice) - 1;

	// Handle cancel
	const cancelIndex = currentPath !== '' ? menuItems.length + 1 : menuItems.length;
	if (choiceIndex === cancelIndex) {
		console.log('Operation cancelled.');
		return;
	}

	// Handle go back
	if (currentPath !== '' && choiceIndex === menuItems.length) {
		const parentPath = currentPath.includes('/')
			? currentPath.substring(0, currentPath.lastIndexOf('/'))
			: '';
		return await removePhoto(existingGallery, parentPath);
	}

	// Validate choice
	if (choiceIndex < 0 || choiceIndex >= menuItems.length) {
		console.log('Invalid selection.');
		return await removePhoto(existingGallery, currentPath);
	}

	const selectedItem = menuItems[choiceIndex];

	// If it's a folder, navigate into it
	if (selectedItem.type === 'folder') {
		return await removePhoto(existingGallery, selectedItem.path);
	}

	// If it's a section with photos, show the photos
	const selectedSection = selectedItem.section;

	console.log(
		`\n${pluralize(selectedSection.photos.length, 'Photo')} in ${selectedSection.section}:`
	);
	selectedSection.photos.forEach((photo, index) => {
		console.log(`${index + 1}. ${photo.filename}`);
	});
	console.log(`${selectedSection.photos.length + 1}. Go back`);
	console.log(`${selectedSection.photos.length + 2}. Cancel`);

	const photoChoice = await prompt('\nEnter photo number to delete: ');
	const photoIndex = parseInt(photoChoice) - 1;

	// Handle go back
	if (photoIndex === selectedSection.photos.length) {
		return await removePhoto(existingGallery, currentPath);
	}

	// Handle cancel
	if (photoIndex === selectedSection.photos.length + 1) {
		console.log('Operation cancelled.');
		return;
	}

	if (photoIndex < 0 || photoIndex >= selectedSection.photos.length) {
		console.log('Invalid selection.');
		return await removePhoto(existingGallery, currentPath);
	}

	const selectedPhoto = selectedSection.photos[photoIndex];

	console.log(`\n⚠️  WARNING: You are about to delete:`);
	console.log(`   Photo: ${selectedPhoto.filename}`);
	console.log(`   Section: ${selectedSection.section}`);
	console.log(`   This will delete the photo file, thumbnail, and gallery entry.`);

	const confirm = await prompt('Are you sure you want to delete this photo? (yes/no): ');
	if (confirm.toLowerCase() !== 'yes') {
		console.log('Operation cancelled.');
		return;
	}

	try {
		// Delete the photo file
		const photoPath = path.join(PHOTOS_DIR, selectedPhoto.src.replace('/photos/', ''));
		if (fs.existsSync(photoPath)) {
			await fsp.unlink(photoPath);
			console.log(`Deleted photo file: ${selectedPhoto.filename}`);
			log(`Deleted photo file: ${photoPath}`);
		}

		// Delete the thumbnail
		const thumbnailPath = path.join(
			THUMBNAILS_DIR,
			selectedPhoto.thumbnailSrc.replace('/photos_thumbnails/', '')
		);
		if (fs.existsSync(thumbnailPath)) {
			await fsp.unlink(thumbnailPath);
			console.log(`Deleted thumbnail: ${selectedPhoto.filename}`);
			log(`Deleted thumbnail: ${thumbnailPath}`);
		}

		// Remove from gallery data
		const updatedGallery = existingGallery
			.map((section) => {
				if (section.section === selectedSection.section) {
					return {
						...section,
						photos: section.photos.filter((p) => p.src !== selectedPhoto.src)
					};
				}
				return section;
			})
			.filter((section) => section.photos.length > 0); // Remove empty sections

		// Save updated gallery data
		fs.writeFileSync(OUTPUT_FILE, JSON.stringify(updatedGallery, null, 2));
		console.log(`Removed photo from gallery data: ${selectedPhoto.filename}`);
		log(
			`Successfully removed photo: ${selectedPhoto.filename} from section: ${selectedSection.section}`
		);
	} catch (err) {
		log(`Error removing photo ${selectedPhoto.filename}: ${err.message}`, true);
		console.error('Error removing photo:', err.message);
	}
}

async function editPhotoExif(existingGallery, currentPath = '') {
	if (existingGallery.length === 0) {
		console.log('No photos found in gallery data.');
		return;
	}

	// Get sections at the current level (reuse same logic as removePhoto)
	const sectionsAtCurrentLevel = new Set();
	const sectionsWithPhotos = [];

	// Find all sections that start with current path
	for (const section of existingGallery) {
		if (section.photos && section.photos.length > 0) {
			const sectionPath = section.section;

			// If we're at root level, show top-level sections
			if (currentPath === '') {
				const topLevel = sectionPath.includes('/') ? sectionPath.split('/')[0] : sectionPath;
				sectionsAtCurrentLevel.add(topLevel);

				// If this section is exactly at the current level (no deeper nesting), add it
				if (!sectionPath.includes('/')) {
					sectionsWithPhotos.push(section);
				}
			} else {
				// If we're in a subfolder, show sections that start with current path
				if (sectionPath.startsWith(currentPath + '/')) {
					const remainingPath = sectionPath.substring(currentPath.length + 1);
					const nextLevel = remainingPath.includes('/')
						? remainingPath.split('/')[0]
						: remainingPath;
					sectionsAtCurrentLevel.add(currentPath + '/' + nextLevel);

					// If this section is exactly at the current level, add it
					if (!remainingPath.includes('/')) {
						sectionsWithPhotos.push(section);
					}
				} else if (sectionPath === currentPath) {
					// If this section is exactly the current path, add it
					sectionsWithPhotos.push(section);
				}
			}
		}
	}

	// Create menu items for folders and direct sections
	const menuItems = [];

	// Add sections that have photos directly at this level
	for (const section of sectionsWithPhotos) {
		menuItems.push({
			type: 'section',
			section: section,
			display: section.section,
			photoCount: section.photos.length
		});
	}

	// Add folders that have photos in subfolders
	for (const sectionPath of sectionsAtCurrentLevel) {
		// Skip if we already added it as a direct section
		const hasDirectPhotos = sectionsWithPhotos.some((s) => s.section === sectionPath);
		if (!hasDirectPhotos) {
			// Count total photos in all subfolders
			let totalPhotos = 0;
			for (const section of existingGallery) {
				if (section.section.startsWith(sectionPath + '/') || section.section === sectionPath) {
					totalPhotos += section.photos ? section.photos.length : 0;
				}
			}

			if (totalPhotos > 0) {
				menuItems.push({
					type: 'folder',
					path: sectionPath,
					display: sectionPath,
					photoCount: totalPhotos
				});
			}
		}
	}

	// Sort menu items
	menuItems.sort((a, b) => a.display.localeCompare(b.display));

	if (menuItems.length === 0) {
		console.log('No sections with photos found.');
		return;
	}

	// Display the menu
	const pathDisplay = currentPath === '' ? 'root' : currentPath;
	console.log(`\nSelect a section to edit photo EXIF data (${pathDisplay}):`);

	menuItems.forEach((item, index) => {
		console.log(
			`${index + 1}. ${item.display} (${item.photoCount} ${pluralize(item.photoCount, 'photo')})`
		);
	});

	// Add back option if we're not at root
	if (currentPath !== '') {
		console.log(`${menuItems.length + 1}. Go back`);
		console.log(`${menuItems.length + 2}. Cancel`);
	} else {
		console.log(`${menuItems.length + 1}. Cancel`);
	}

	const choice = await prompt('\nEnter your choice: ');
	const choiceIndex = parseInt(choice) - 1;

	// Handle cancel
	const cancelIndex = currentPath !== '' ? menuItems.length + 1 : menuItems.length;
	if (choiceIndex === cancelIndex) {
		console.log('Operation cancelled.');
		return;
	}

	// Handle go back
	if (currentPath !== '' && choiceIndex === menuItems.length) {
		const parentPath = currentPath.includes('/')
			? currentPath.substring(0, currentPath.lastIndexOf('/'))
			: '';
		return await editPhotoExif(existingGallery, parentPath);
	}

	// Validate choice
	if (choiceIndex < 0 || choiceIndex >= menuItems.length) {
		console.log('Invalid selection.');
		return await editPhotoExif(existingGallery, currentPath);
	}

	const selectedItem = menuItems[choiceIndex];

	// If it's a folder, navigate into it
	if (selectedItem.type === 'folder') {
		return await editPhotoExif(existingGallery, selectedItem.path);
	}

	// If it's a section with photos, show the photos
	const selectedSection = selectedItem.section;

	console.log(
		`\n${pluralize(selectedSection.photos.length, 'Photo')} in ${selectedSection.section}:`
	);
	selectedSection.photos.forEach((photo, index) => {
		console.log(`${index + 1}. ${photo.filename}`);
	});
	console.log(`${selectedSection.photos.length + 1}. Go back`);
	console.log(`${selectedSection.photos.length + 2}. Cancel`);

	const photoChoice = await prompt('\nEnter photo number to edit: ');
	const photoIndex = parseInt(photoChoice) - 1;

	// Handle go back
	if (photoIndex === selectedSection.photos.length) {
		return await editPhotoExif(existingGallery, currentPath);
	}

	// Handle cancel
	if (photoIndex === selectedSection.photos.length + 1) {
		console.log('Operation cancelled.');
		return;
	}

	if (photoIndex < 0 || photoIndex >= selectedSection.photos.length) {
		console.log('Invalid selection.');
		return await editPhotoExif(existingGallery, currentPath);
	}

	const selectedPhoto = selectedSection.photos[photoIndex];

	// Show current EXIF data and edit options
	await editPhotoExifData(selectedPhoto, selectedSection, existingGallery);
}

// Helper function to validate and parse date in EXIF format
function validateAndFormatExifDate(input) {
	if (!input || input.trim() === '') return null;

	// Try to parse various date formats and convert to EXIF format (YYYY:MM:DD HH:MM:SS)
	const dateStr = input.trim();

	// Check if already in EXIF format
	if (/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
		const date = new Date(
			dateStr.replace(/:/g, '-').substring(0, 10) + 'T' + dateStr.substring(11)
		);
		if (!isNaN(date.getTime())) return dateStr;
	}

	// Try standard ISO format
	const date = new Date(dateStr);
	if (!isNaN(date.getTime())) {
		return date
			.toISOString()
			.replace(/T/, ' ')
			.replace(/\.\d{3}Z$/, '')
			.replace(/-/g, ':');
	}

	return null;
}

// Helper function to validate GPS coordinates
function validateGPS(input) {
	if (!input || input.trim() === '') return null;

	try {
		const coords = JSON.parse(input);
		if (
			typeof coords.lat === 'number' &&
			typeof coords.lon === 'number' &&
			coords.lat >= -90 &&
			coords.lat <= 90 &&
			coords.lon >= -180 &&
			coords.lon <= 180
		) {
			return coords;
		}
	} catch {
		// Try parsing as "lat,lon" format
		const parts = input.split(',');
		if (parts.length === 2) {
			const lat = parseFloat(parts[0].trim());
			const lon = parseFloat(parts[1].trim());
			if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
				return { lat, lon };
			}
		}
	}

	return null;
}

// Helper function to validate ISO value
function validateISO(input) {
	if (!input || input.trim() === '') return null;
	const iso = parseInt(input.trim());
	if (!isNaN(iso) && iso > 0 && iso <= 409600) {
		// Reasonable ISO range
		return iso;
	}
	return null;
}

// Helper function to validate subject
function validateSubject(input) {
	if (!input || input.trim() === '') return null;

	const validSubjects = [
		'bugs',
		'spiders',
		'birds',
		'plants',
		'flowers',
		'mammals',
		'reptiles',
		'amphibians',
		'fish',
		'landscape',
		'architecture',
		'people',
		'vehicles',
		'food',
		'art',
		'dogs',
		'cats',
		'night',
		'fungi',
		'mushrooms'
	];

	const subject = input.trim().toLowerCase();
	if (validSubjects.includes(subject)) {
		return subject;
	}

	console.log(`Valid subjects: ${validSubjects.join(', ')}`);
	return null;
}

async function editPhotoExifData(selectedPhoto, selectedSection, existingGallery, changes = []) {
	console.log(`\n=== EDITING EXIF DATA FOR: ${selectedPhoto.filename} ===`);
	console.log(`Section: ${selectedSection.section}`);

	// Display current EXIF data
	console.log('\nCurrent EXIF data:');
	console.log(`1. Title: ${selectedPhoto.title || 'Not set'}`);
	console.log(`2. Date: ${selectedPhoto.date || 'Not set'}`);
	console.log(`3. Camera: ${selectedPhoto.camera || 'Not set'}`);
	console.log(`4. Lens: ${selectedPhoto.lens || 'Not set'}`);
	console.log(`5. Focal Length: ${selectedPhoto.focalLength || 'Not set'}`);
	console.log(`6. Aperture: ${selectedPhoto.aperture || 'Not set'}`);
	console.log(`7. Exposure: ${selectedPhoto.exposure || 'Not set'}`);
	console.log(`8. ISO: ${selectedPhoto.iso || 'Not set'}`);
	console.log(
		`9. GPS: ${selectedPhoto.gps ? `${selectedPhoto.gps.lat}, ${selectedPhoto.gps.lon}` : 'Not set'}`
	);
	console.log(`10. Subject: ${selectedPhoto.subject || 'Not set'}`);
	console.log('11. Done editing');
	console.log('12. Cancel');

	const choice = await prompt('\nSelect field to edit (1-12): ');
	const fieldIndex = parseInt(choice);

	if (fieldIndex === 11) {
		// Save changes
		try {
			const updatedGallery = existingGallery.map((section) => {
				if (section.section === selectedSection.section) {
					return {
						...section,
						photos: section.photos.map((photo) =>
							photo.src === selectedPhoto.src ? selectedPhoto : photo
						)
					};
				}
				return section;
			});

			fs.writeFileSync(OUTPUT_FILE, JSON.stringify(updatedGallery, null, 2));
			console.log(`✅ EXIF data updated for: ${selectedPhoto.filename}`);

			// Log detailed changes
			if (changes.length > 0) {
				log(
					`EXIF data updated for photo: ${selectedPhoto.filename} in section: ${selectedSection.section}`
				);
				changes.forEach((change) => {
					log(`  Changed ${change.field}: "${change.from}" → "${change.to}"`);
				});
			} else {
				log(
					`EXIF editing session completed for photo: ${selectedPhoto.filename} (no changes made)`
				);
			}
		} catch (err) {
			log(`Error updating EXIF data for ${selectedPhoto.filename}: ${err.message}`, true);
			console.error('Error updating EXIF data:', err.message);
		}
		return;
	}

	if (fieldIndex === 12) {
		console.log('Editing cancelled.');
		if (changes.length > 0) {
			log(
				`EXIF editing cancelled for photo: ${selectedPhoto.filename} (${changes.length} ${pluralize(changes.length, 'change')} were made but not saved)`
			);
		}
		return;
	}

	if (fieldIndex < 1 || fieldIndex > 12) {
		console.log('Invalid selection.');
		return await editPhotoExifData(selectedPhoto, selectedSection, existingGallery, changes);
	}

	// Helper function to format values for logging
	const formatValueForLog = (value) => {
		if (value === null || value === undefined) return 'Not set';
		if (typeof value === 'object' && value.lat && value.lon) return `${value.lat}, ${value.lon}`;
		return String(value);
	};

	// Edit the selected field
	let newValue;
	let isValid = false;
	let fieldCancelled = false;
	let fieldName = '';
	let originalValue;

	switch (fieldIndex) {
		case 1: // Title
			fieldName = 'Title';
			originalValue = selectedPhoto.title;
			newValue = await prompt(
				`Enter new title (current: "${selectedPhoto.title || 'Not set'}"), or "cancel" to keep current: `
			);
			if (newValue.toLowerCase() === 'cancel') {
				fieldCancelled = true;
			} else {
				if (newValue.trim() === '') newValue = null;
				if (originalValue !== newValue) {
					changes.push({
						field: fieldName,
						from: formatValueForLog(originalValue),
						to: formatValueForLog(newValue)
					});
				}
				selectedPhoto.title = newValue;
				isValid = true;
			}
			break;

		case 2: // Date
			fieldName = 'Date';
			originalValue = selectedPhoto.date;
			while (!isValid && !fieldCancelled) {
				newValue = await prompt(
					`Enter new date in YYYY:MM:DD HH:MM:SS format (current: "${selectedPhoto.date || 'Not set'}"), or "cancel" to keep current: `
				);
				if (newValue.toLowerCase() === 'cancel') {
					fieldCancelled = true;
				} else if (newValue.trim() === '') {
					newValue = null;
					if (originalValue !== newValue) {
						changes.push({
							field: fieldName,
							from: formatValueForLog(originalValue),
							to: formatValueForLog(newValue)
						});
					}
					selectedPhoto.date = newValue;
					isValid = true;
				} else {
					const validDate = validateAndFormatExifDate(newValue);
					if (validDate) {
						if (originalValue !== validDate) {
							changes.push({
								field: fieldName,
								from: formatValueForLog(originalValue),
								to: formatValueForLog(validDate)
							});
						}
						selectedPhoto.date = validDate;
						isValid = true;
					} else {
						console.log(
							'Invalid date format. Please use YYYY:MM:DD HH:MM:SS or standard date format, or type "cancel" to keep current value.'
						);
					}
				}
			}
			break;

		case 3: // Camera
			fieldName = 'Camera';
			originalValue = selectedPhoto.camera;
			newValue = await prompt(
				`Enter new camera (current: "${selectedPhoto.camera || 'Not set'}"), or "cancel" to keep current: `
			);
			if (newValue.toLowerCase() === 'cancel') {
				fieldCancelled = true;
			} else {
				newValue = newValue.trim() === '' ? null : newValue;
				if (originalValue !== newValue) {
					changes.push({
						field: fieldName,
						from: formatValueForLog(originalValue),
						to: formatValueForLog(newValue)
					});
				}
				selectedPhoto.camera = newValue;
				isValid = true;
			}
			break;

		case 4: // Lens
			fieldName = 'Lens';
			originalValue = selectedPhoto.lens;
			newValue = await prompt(
				`Enter new lens (current: "${selectedPhoto.lens || 'Not set'}"), or "cancel" to keep current: `
			);
			if (newValue.toLowerCase() === 'cancel') {
				fieldCancelled = true;
			} else {
				newValue = newValue.trim() === '' ? null : newValue;
				if (originalValue !== newValue) {
					changes.push({
						field: fieldName,
						from: formatValueForLog(originalValue),
						to: formatValueForLog(newValue)
					});
				}
				selectedPhoto.lens = newValue;
				isValid = true;
			}
			break;

		case 5: // Focal Length
			fieldName = 'Focal Length';
			originalValue = selectedPhoto.focalLength;
			newValue = await prompt(
				`Enter new focal length (current: "${selectedPhoto.focalLength || 'Not set'}"), or "cancel" to keep current: `
			);
			if (newValue.toLowerCase() === 'cancel') {
				fieldCancelled = true;
			} else {
				newValue = newValue.trim() === '' ? null : newValue;
				if (originalValue !== newValue) {
					changes.push({
						field: fieldName,
						from: formatValueForLog(originalValue),
						to: formatValueForLog(newValue)
					});
				}
				selectedPhoto.focalLength = newValue;
				isValid = true;
			}
			break;

		case 6: // Aperture
			fieldName = 'Aperture';
			originalValue = selectedPhoto.aperture;
			newValue = await prompt(
				`Enter new aperture (current: "${selectedPhoto.aperture || 'Not set'}"), or "cancel" to keep current: `
			);
			if (newValue.toLowerCase() === 'cancel') {
				fieldCancelled = true;
			} else {
				newValue = newValue.trim() === '' ? null : newValue;
				if (originalValue !== newValue) {
					changes.push({
						field: fieldName,
						from: formatValueForLog(originalValue),
						to: formatValueForLog(newValue)
					});
				}
				selectedPhoto.aperture = newValue;
				isValid = true;
			}
			break;

		case 7: // Exposure
			fieldName = 'Exposure';
			originalValue = selectedPhoto.exposure;
			newValue = await prompt(
				`Enter new exposure (current: "${selectedPhoto.exposure || 'Not set'}"), or "cancel" to keep current: `
			);
			if (newValue.toLowerCase() === 'cancel') {
				fieldCancelled = true;
			} else {
				newValue = newValue.trim() === '' ? null : newValue;
				if (originalValue !== newValue) {
					changes.push({
						field: fieldName,
						from: formatValueForLog(originalValue),
						to: formatValueForLog(newValue)
					});
				}
				selectedPhoto.exposure = newValue;
				isValid = true;
			}
			break;

		case 8: // ISO
			fieldName = 'ISO';
			originalValue = selectedPhoto.iso;
			while (!isValid && !fieldCancelled) {
				newValue = await prompt(
					`Enter new ISO (current: "${selectedPhoto.iso || 'Not set'}"), or "cancel" to keep current: `
				);
				if (newValue.toLowerCase() === 'cancel') {
					fieldCancelled = true;
				} else if (newValue.trim() === '') {
					newValue = null;
					if (originalValue !== newValue) {
						changes.push({
							field: fieldName,
							from: formatValueForLog(originalValue),
							to: formatValueForLog(newValue)
						});
					}
					selectedPhoto.iso = newValue;
					isValid = true;
				} else {
					const validISO = validateISO(newValue);
					if (validISO !== null) {
						if (originalValue !== validISO) {
							changes.push({
								field: fieldName,
								from: formatValueForLog(originalValue),
								to: formatValueForLog(validISO)
							});
						}
						selectedPhoto.iso = validISO;
						isValid = true;
					} else {
						console.log(
							'Invalid ISO value. Please enter a number between 1 and 409600, or type "cancel" to keep current value.'
						);
					}
				}
			}
			break;

		case 9: // GPS
			fieldName = 'GPS';
			originalValue = selectedPhoto.gps;
			while (!isValid && !fieldCancelled) {
				const currentGPS = selectedPhoto.gps
					? `${selectedPhoto.gps.lat}, ${selectedPhoto.gps.lon}`
					: 'Not set';
				newValue = await prompt(
					`Enter new GPS coordinates as "lat,lon" or JSON (current: "${currentGPS}"), or "cancel" to keep current: `
				);
				if (newValue.toLowerCase() === 'cancel') {
					fieldCancelled = true;
				} else if (newValue.trim() === '') {
					newValue = null;
					if (JSON.stringify(originalValue) !== JSON.stringify(newValue)) {
						changes.push({
							field: fieldName,
							from: formatValueForLog(originalValue),
							to: formatValueForLog(newValue)
						});
					}
					selectedPhoto.gps = newValue;
					isValid = true;
				} else {
					const validGPS = validateGPS(newValue);
					if (validGPS) {
						if (JSON.stringify(originalValue) !== JSON.stringify(validGPS)) {
							changes.push({
								field: fieldName,
								from: formatValueForLog(originalValue),
								to: formatValueForLog(validGPS)
							});
						}
						selectedPhoto.gps = validGPS;
						isValid = true;
					} else {
						console.log(
							'Invalid GPS format. Use "lat,lon" (e.g., "40.7128,-74.0060") or JSON format, or type "cancel" to keep current value.'
						);
					}
				}
			}
			break;

		case 10: // Subject
			fieldName = 'Subject';
			originalValue = selectedPhoto.subject;
			while (!isValid && !fieldCancelled) {
				newValue = await prompt(
					`Enter new subject (current: "${selectedPhoto.subject || 'Not set'}"), or "cancel" to keep current: `
				);
				if (newValue.toLowerCase() === 'cancel') {
					fieldCancelled = true;
				} else if (newValue.trim() === '') {
					newValue = null;
					if (originalValue !== newValue) {
						changes.push({
							field: fieldName,
							from: formatValueForLog(originalValue),
							to: formatValueForLog(newValue)
						});
					}
					selectedPhoto.subject = newValue;
					isValid = true;
				} else {
					const validSubject = validateSubject(newValue);
					if (validSubject) {
						if (originalValue !== validSubject) {
							changes.push({
								field: fieldName,
								from: formatValueForLog(originalValue),
								to: formatValueForLog(validSubject)
							});
						}
						selectedPhoto.subject = validSubject;
						isValid = true;
					} else {
						console.log(
							'Invalid subject. Please try again, or type "cancel" to keep current value.'
						);
					}
				}
			}
			break;
	}

	if (fieldCancelled) {
		console.log('✓ Field edit cancelled - keeping current value.');
	} else if (isValid) {
		console.log('✓ Field updated successfully.');
	}

	// Continue editing, passing along the changes array
	return await editPhotoExifData(selectedPhoto, selectedSection, existingGallery, changes);
}

// Update the showMainMenu function to include the new option
async function showMainMenu(scanResults) {
	console.log('\n=== PHOTO PROCESSING MENU ===');
	console.log('1. Process new photos (convert and add to gallery)');
	console.log('2. Add orphaned WebP files to gallery');
	console.log('3. Remove missing photos from gallery data');
	console.log('4. Remove a specific photo');
	console.log('5. Edit photo EXIF data');
	console.log('6. Delete ALL photos and data (with confirmation)');
	console.log('7. Refresh scan results');
	console.log('8. Exit without changes');

	const choice = await prompt('\nEnter your choice (1-8): ');

	switch (choice) {
		case '1': {
			const workDone = await processNewPhotos(scanResults.newPhotos, scanResults.existingGallery);
			if (workDone) {
				// Only rescan if work was actually done
				const newScanResults = await scanPhotosDirectory();
				return await showMainMenu(newScanResults);
			} else {
				// No work done, return to menu with same results
				return await showMainMenu(scanResults);
			}
		}

		case '2': {
			const workDone = await addOrphanedPhotos(
				scanResults.orphanedWebPs,
				scanResults.existingGallery
			);
			if (workDone) {
				// Only rescan if work was actually done
				const newScanResults = await scanPhotosDirectory();
				return await showMainMenu(newScanResults);
			} else {
				// No work done, return to menu with same results
				return await showMainMenu(scanResults);
			}
		}

		case '3': {
			const workDone = await removeMissingPhotos(
				scanResults.missingPhotos,
				scanResults.existingGallery
			);
			if (workDone) {
				// Only rescan if work was actually done
				const newScanResults = await scanPhotosDirectory();
				return await showMainMenu(newScanResults);
			} else {
				// No work done, return to menu with same results
				return await showMainMenu(scanResults);
			}
		}

		case '4': {
			await removePhoto(scanResults.existingGallery);
			// Always rescan after photo removal attempt (even if cancelled)
			const newScanResults = await scanPhotosDirectory();
			return await showMainMenu(newScanResults);
		}

		case '5': {
			await editPhotoExif(scanResults.existingGallery);
			// Always rescan after EXIF editing attempt (even if cancelled)
			const newScanResults = await scanPhotosDirectory();
			return await showMainMenu(newScanResults);
		}

		case '6': {
			await deleteAllPhotosAndData();
			// Always rescan after deletion attempt (even if cancelled)
			const newScanResults = await scanPhotosDirectory();
			return await showMainMenu(newScanResults);
		}

		case '7': {
			// Refresh scan results
			const newScanResults = await scanPhotosDirectory();
			return await showMainMenu(newScanResults);
		}

		case '8':
			console.log('Exiting without changes.');
			return;

		default:
			console.log('Invalid choice. Please try again.');
			return await showMainMenu(scanResults);
	}
}

async function main() {
	console.log('Photo Processing Tool');
	console.log('====================');

	log('Photo processing tool started');

	try {
		const scanResults = await scanPhotosDirectory();
		await showMainMenu(scanResults);
	} catch (err) {
		log(`Fatal error in main: ${err.message}`, true);
		console.error('Fatal error:', err.message);
	} finally {
		rl.close();
		log('Photo processing tool ended');
	}
}

main().catch(console.error);
