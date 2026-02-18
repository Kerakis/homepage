import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Configuration ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paths to input files
const SAMPLING_FILE = path.join(
	__dirname,
	'../static/bird_data/ebd_US-TN-093_smp_relJan-2026_sampling.txt'
);
const OBSERVATION_FILE = path.join(
	__dirname,
	'../static/bird_data/ebd_US-TN-093_smp_relJan-2026.txt'
);

// Output files
const OUTPUT_FILE = path.join(__dirname, '../src/lib/data/seasonal_hotspots.json');
const HOTSPOTS_OUTPUT_FILE = path.join(__dirname, '../src/lib/data/hotspots.json');
const STATS_OUTPUT_FILE = path.join(__dirname, '../src/lib/data/stats.json');
const SPECIES_LOCATIONS_FILE = path.join(__dirname, '../src/lib/data/species_locations.json');

// Constants
const MIN_COMPLETE_CHECKLISTS = 40; // Hotspot must have at least this many checklists in the season
const NOTABLE_SCORE_THRESHOLD = 1.5; // Species must be 1.5x more frequent in hotspot than region
const MAX_SPECIES_SCORE = 15; // Cap score to prevent one rare bird from dominating ranking
const MIN_YEARS_PRESENT_RATIO = 0.3; // Species must be present in at least 30% of years with data
const MIN_YEARS_PRESENT_ABSOLUTE = 2; // Species MUST be seen in at least 2 separate years to be Notable
const RARITY_REGION_FREQ_THRESHOLD = 0.01; // Species seen on < 1% of region checklists is a "Rarity"
const RECENT_YEARS = 10;
const CURRENT_YEAR = new Date().getFullYear();

if (process.versions.node.split('.')[0] < 18) {
	console.error('Node.js 18+ required for fetch API');
	process.exit(1);
}

// --- Helper Functions ---
async function fetchTaxonomy() {
	console.log('Fetching eBird taxonomy...');
	const response = await fetch('https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json');
	if (!response.ok) throw new Error(`Failed to fetch taxonomy: ${response.statusText}`);
	const taxonomy = await response.json();
	const codeMap = new Map();
	for (const taxon of taxonomy) {
		codeMap.set(taxon.comName, taxon.speciesCode);
	}
	console.log(`Taxonomy loaded: ${codeMap.size} species.`);
	return codeMap;
}

function getSeason(dateStr) {
	// dateStr format: YYYY-MM-DD
	const month = parseInt(dateStr.split('-')[1], 10);

	// Spring: Mar(3), Apr(4), May(5)
	if (month >= 3 && month <= 5) return 'spring';
	// Summer: Jun(6), Jul(7), Aug(8)
	if (month >= 6 && month <= 8) return 'summer';
	// Fall: Sep(9), Oct(10), Nov(11)
	if (month >= 9 && month <= 11) return 'fall';
	// Winter: Dec(12), Jan(1), Feb(2)
	return 'winter';
}

function getYear(dateStr) {
	if (!dateStr) return 0;
	return parseInt(dateStr.split('-')[0], 10);
}

// --- Data Structures ---

// Pass 1: Sampling Data
// Map<SamplingEventID, { locId: string, season: string, year: number }>
const validChecklists = new Map();

// Stats for Denominators
// Map<Season, TotalRegionChecklists>
const regionChecklistsPerSeason = { spring: 0, summer: 0, fall: 0, winter: 0 };

// Map<LocId, Map<Season, count>>
const hotspotChecklistsPerSeason = new Map();

// Map<LocId, Map<Season, Set<Year>>>
// Tracks which years a hotspot had ANY complete checklists in a given season
const hotspotYearsWithData = new Map();

// Map<LocId, Name>
const hotspotNames = new Map();

// Map<LocId, {lat, lng}>
const hotspotCoords = new Map();

// New Global Stats:
const regionAllTimeSpecies = new Set();
const hotspotAllTimeSpecies = new Map(); // locId -> Set<Species>
const speciesCodes = new Map(); // CommonName -> SpeciesCode

// Pass 2: Observation Data
// Map<Season, Map<Species, Count>>
const regionSpeciesCounts = {
	spring: new Map(),
	summer: new Map(),
	fall: new Map(),
	winter: new Map()
};

// Map<LocId, Map<Season, Map<Species, Count>>>
const hotspotSpeciesCounts = new Map();

// Map<LocId, Map<Season, Map<Species, Set<Year>>>>
// Tracks distinct years a species was seen at a hotspot during a season
const hotspotSpeciesYears = new Map();

// --- Main Execution ---

async function processSamplingFile() {
	console.log(`Processing Sampling File: ${SAMPLING_FILE}`);
	if (!fs.existsSync(SAMPLING_FILE)) {
		console.error(`Error: Sampling file not found at ${SAMPLING_FILE}`);
		process.exit(1);
	}

	const fileStream = fs.createReadStream(SAMPLING_FILE);
	const rl = readline.createInterface({
		input: fileStream,
		crlfDelay: Infinity
	});

	let headerMap = null;
	let count = 0;

	for await (const line of rl) {
		const columns = line.split('\t'); // tab-separated

		if (!headerMap) {
			headerMap = new Map(columns.map((name, index) => [name.toUpperCase(), index]));
			continue;
		}

		const allSpeciesReported = columns[headerMap.get('ALL SPECIES REPORTED')];
		if (allSpeciesReported !== '1') continue;

		const dateStr = columns[headerMap.get('OBSERVATION DATE')];
		const year = getYear(dateStr);
		if (year < CURRENT_YEAR - RECENT_YEARS) continue;

		const locType = columns[headerMap.get('LOCALITY TYPE')];
		// 'H' is Hotspot
		if (locType !== 'H') continue;

		const sid = columns[headerMap.get('SAMPLING EVENT IDENTIFIER')];
		const locId = columns[headerMap.get('LOCALITY ID')];
		const locName = columns[headerMap.get('LOCALITY')];

		// Filter out restricted access locations
		const restrictedTerms = ['no access', 'restricted access', 'private property'];
		if (restrictedTerms.some((term) => locName.toLowerCase().includes(term))) continue;

		const season = getSeason(dateStr);

		// Store valid checklist
		validChecklists.set(sid, { locId, season, year });

		// Update Region Totals
		regionChecklistsPerSeason[season]++;

		// Update Hotspot Totals
		if (!hotspotChecklistsPerSeason.has(locId)) {
			hotspotChecklistsPerSeason.set(locId, { spring: 0, summer: 0, fall: 0, winter: 0 });
			hotspotNames.set(locId, locName);

			// Capture Coords (only need once per hotspot)
			const lat = parseFloat(columns[headerMap.get('LATITUDE')]);
			const lng = parseFloat(columns[headerMap.get('LONGITUDE')]);
			if (!isNaN(lat) && !isNaN(lng)) {
				hotspotCoords.set(locId, { lat, lng });
			}

			// Init All-Time Species Tracking
			hotspotAllTimeSpecies.set(locId, new Set());

			hotspotYearsWithData.set(locId, {
				spring: new Set(),
				summer: new Set(),
				fall: new Set(),
				winter: new Set()
			});
		}
		hotspotChecklistsPerSeason.get(locId)[season]++;
		hotspotYearsWithData.get(locId)[season].add(year);

		if (++count % 50000 === 0) process.stdout.write(`\rLoaded ${count} valid checklists...`);
	}
	console.log(`\nValues loaded. Total valid checklists: ${validChecklists.size}`);
}

async function processObservationFile() {
	console.log(`Processing Observation File: ${OBSERVATION_FILE}`);
	if (!fs.existsSync(OBSERVATION_FILE)) {
		console.error(`Error: Observation file not found at ${OBSERVATION_FILE}`);
		process.exit(1);
	}

	const fileStream = fs.createReadStream(OBSERVATION_FILE);
	const rl = readline.createInterface({
		input: fileStream,
		crlfDelay: Infinity
	});

	// Deduplication set: Set<"ChecklistID|CommonName">
	const checklistSpeciesSeen = new Set();
	let headerMap = null;
	let count = 0;

	for await (const line of rl) {
		const columns = line.split('\t');

		if (!headerMap) {
			headerMap = new Map(columns.map((name, index) => [name.toUpperCase(), index]));
			continue;
		}

		const sid = columns[headerMap.get('SAMPLING EVENT IDENTIFIER')];

		// Only process if it belongs to a valid complete checklist from Pass 1
		const checklistInfo = validChecklists.get(sid);
		if (!checklistInfo) continue;

		const { locId, season, year } = checklistInfo;
		const commonName = columns[headerMap.get('COMMON NAME')];

		// Ignore "spuhs" and slashes
		if (!commonName || commonName.includes('sp.') || commonName.includes('/')) continue;

		// Deduplication: Ensuring each species is counted only once per checklist
		const dedupKey = `${sid}|${commonName}`;
		if (checklistSpeciesSeen.has(dedupKey)) continue;
		checklistSpeciesSeen.add(dedupKey);

		// --- Update All-Time Stats ---
		// We know locId exists in hotspotAllTimeSpecies because we initialized it in Pass 1
		hotspotAllTimeSpecies.get(locId).add(commonName);
		regionAllTimeSpecies.add(commonName);
		// -----------------------------

		if (locId === 'L208776' && season === 'spring') {
			// Debug for Black-throated Green Warbler at Sharp's Ridge
			/* 
			const targetSpecies = 'Black-throated Green Warbler';
			if (commonName === targetSpecies) {
				console.log(`DEBUG: Found ${targetSpecies} at Sharp's Ridge (SID: ${sid})`);
			}
			*/
		}

		// 1. Region Count
		const sMap = regionSpeciesCounts[season];
		sMap.set(commonName, (sMap.get(commonName) || 0) + 1);

		// 2. Hotspot Count
		if (!hotspotSpeciesCounts.has(locId)) {
			hotspotSpeciesCounts.set(locId, {
				spring: new Map(),
				summer: new Map(),
				fall: new Map(),
				winter: new Map()
			});
			hotspotSpeciesYears.set(locId, {
				spring: new Map(),
				summer: new Map(),
				fall: new Map(),
				winter: new Map()
			});
		}

		const hSeasonMap = hotspotSpeciesCounts.get(locId)[season];
		hSeasonMap.set(commonName, (hSeasonMap.get(commonName) || 0) + 1);

		// Track Years Present for Consistency Check
		const hSpeciesYearMap = hotspotSpeciesYears.get(locId)[season];
		if (!hSpeciesYearMap.has(commonName)) {
			hSpeciesYearMap.set(commonName, new Set());
		}
		hSpeciesYearMap.get(commonName).add(year);

		if (++count % 50000 === 0) process.stdout.write(`\rProcessed ${count} observations...`);
	}
	console.log(`\nObservations processed.`);
}

function calculateNotableSpecies() {
	console.log('Calculating Notable Species Scores...');
	const result = { spring: [], summer: [], fall: [], winter: [] };
	const seasons = ['spring', 'summer', 'fall', 'winter'];

	// Pre-calculate region frequencies
	const regionFreqs = {};
	for (const seas of seasons) {
		regionFreqs[seas] = new Map();
		const total = regionChecklistsPerSeason[seas];
		if (total === 0) continue;

		for (const [species, count] of regionSpeciesCounts[seas].entries()) {
			regionFreqs[seas].set(species, count / total);
		}
	}

	// Iterate over every hotspot
	for (const [locId, seasonCounts] of hotspotChecklistsPerSeason.entries()) {
		const locName = hotspotNames.get(locId);

		for (const seas of seasons) {
			const locTotalChecklists = seasonCounts[seas];

			// Filter: Data Sufficiency (Checklists)
			if (locTotalChecklists < MIN_COMPLETE_CHECKLISTS) continue;

			// Get count of years this hotspot had data for this season
			const yearsWithData = hotspotYearsWithData.get(locId)?.[seas]?.size || 0;
			if (yearsWithData === 0) continue;

			const speciesCounts = hotspotSpeciesCounts.get(locId)?.[seas];
			const speciesYearMap = hotspotSpeciesYears.get(locId)?.[seas];

			if (!speciesCounts || !speciesYearMap) continue;

			const notableSpecies = [];
			const rareSpecies = [];

			for (const [species, count] of speciesCounts.entries()) {
				const regFreq = regionFreqs[seas].get(species) || 0;

				// --- Logic Branch: Is it a Rarity?
				// Rare if seen on < 1% of checklists across the whole county
				const isRareInRegion = regFreq < RARITY_REGION_FREQ_THRESHOLD;

				// --- Logic Branch: Is it Notable?
				// 1. Data Consistency Check
				const yearsPresent = speciesYearMap.get(species)?.size || 0;
				const presenceRatio = yearsPresent / yearsWithData;

				let isNotable = false;

				// Rule: Must be seen in at least 2 separate years (Absolute Consistency)
				// This filters out "One-Year Wonders" like the Little Blue Heron at Eldridge
				if (yearsPresent >= MIN_YEARS_PRESENT_ABSOLUTE) {
					// Rule: Must be seen in at least 30% of years with data (Relative Consistency)
					if (presenceRatio >= MIN_YEARS_PRESENT_RATIO) {
						const locFreq = count / locTotalChecklists;
						if (regFreq > 0) {
							let score = locFreq / regFreq;
							if (score > NOTABLE_SCORE_THRESHOLD) {
								score = Math.min(score, MAX_SPECIES_SCORE);
								isNotable = true;
								// Add to Notable List
								notableSpecies.push({
									name: species,
									score: parseFloat(score.toFixed(2)),
									frequency: parseFloat(locFreq.toFixed(3)),
									regionFrequency: parseFloat(regFreq.toFixed(3)),
									obsCount: count,
									yearsPresent: yearsPresent,
									yearsTotal: yearsWithData
								});
							}
						}
					}
				}

				// If it's NOT Notable, but it IS Rare (for region), add to Rarities list
				// (We exclude Notable birds from the "Rarities" list to avoid duplication)
				if (!isNotable && isRareInRegion) {
					rareSpecies.push({
						name: species,
						// For rarities, we care about "How many times seen?"
						obsCount: count,
						lastSeenYear: Math.max(...(speciesYearMap.get(species) || [])),
						frequency: parseFloat((count / locTotalChecklists).toFixed(4))
					});
				}
			}

			if (notableSpecies.length > 0 || rareSpecies.length > 0) {
				// Sort species
				notableSpecies.sort((a, b) => b.score - a.score);
				rareSpecies.sort((a, b) => b.obsCount - a.obsCount); // Sort rarities by most sightings

				// Calculate a "Hotspot Rank Score"
				// We sum the scores of ALL notable species to reward depth of quality
				// (A place with 50 good species is better than a place with 5 amazing ones)
				const notableScore = notableSpecies.reduce((sum, s) => sum + s.score, 0);

				// Adjust score by seasonal species richness (square root)
				const richness = speciesCounts.size;
				const rankScore = notableScore * Math.sqrt(richness || 1);

				const coords = hotspotCoords.get(locId);

				result[seas].push({
					hotspotId: locId,
					hotspotName: locName,
					latitude: coords ? coords.lat : 0,
					longitude: coords ? coords.lng : 0,
					rankScore: rankScore,
					seasonalSpeciesCount: notableSpecies.length,
					notableSpecies: notableSpecies.slice(0, 5), // Display top 5 notable
					rareSpecies: rareSpecies.slice(0, 5) // Display top 5 rarities
				});
			}
		}
	}

	for (const seas of seasons) {
		result[seas].sort((a, b) => b.rankScore - a.rankScore);
		result[seas] = result[seas].slice(0, 15); // Top 15 hotspots

		// Clean up rankScore before output
		result[seas].forEach((h) => delete h.rankScore);
	}

	return result;
}

function generateSpeciesLocations() {
	console.log('Generating Species Locations Map...');
	const result = {};
	const seasons = ['spring', 'summer', 'fall', 'winter'];

	for (const species of regionAllTimeSpecies) {
		// Use the map populated from taxonomy fetch
		const code = speciesCodeMap.get(species) || '';

		result[species] = {
			code: code,
			seasons: {
				spring: [],
				summer: [],
				fall: [],
				winter: []
			}
		};

		for (const seas of seasons) {
			const hotspotsForSeason = [];

			// Find all hotspots that have data for this season
			for (const [locId, seasonCounts] of hotspotChecklistsPerSeason.entries()) {
				const totalChecklists = seasonCounts[seas];
				if (totalChecklists < MIN_COMPLETE_CHECKLISTS) continue;

				// Check if species was seen here
				const countMap = hotspotSpeciesCounts.get(locId)?.[seas];
				const count = countMap?.get(species);

				if (count) {
					const frequency = count / totalChecklists;
					hotspotsForSeason.push({
						id: locId,
						name: hotspotNames.get(locId),
						frequency: parseFloat(frequency.toFixed(4)) // Keep precision reasonable
					});
				}
			}

			// Sort by frequency descending
			hotspotsForSeason.sort((a, b) => b.frequency - a.frequency);

			// Keep top 5
			result[species].seasons[seas] = hotspotsForSeason.slice(0, 5);
		}
	}

	// Filter out species with NO data across all seasons to save space?
	// The regionAllTimeSpecies only includes species seen at least once, but maybe not in a hotspot meeting MIN_COMPLETE_CHECKLISTS.
	for (const species of Object.keys(result)) {
		const hasData = seasons.some((seas) => result[species].seasons[seas].length > 0);
		if (!hasData) {
			delete result[species];
		}
	}

	return result;
}

// --- Run ---
let speciesCodeMap = new Map();

(async () => {
	try {
		speciesCodeMap = await fetchTaxonomy();
		await processSamplingFile();
		await processObservationFile();
		const seasonalData = calculateNotableSpecies();
		const speciesLocations = generateSpeciesLocations();

		// Ensure output dir exists
		const outDir = path.dirname(OUTPUT_FILE);
		if (!fs.existsSync(outDir)) {
			fs.mkdirSync(outDir, { recursive: true });
		}

		// 1. Seasonal Hotspots (Existing)
		fs.writeFileSync(OUTPUT_FILE, JSON.stringify(seasonalData, null, 2));
		console.log(`Success! Seasonal data written to ${OUTPUT_FILE}`);

		// 2. All Hotspots List (Replacement for fetchKnoxCountyHotspots)
		const allHotspots = [];
		for (const [locId, name] of hotspotNames) {
			const coords = hotspotCoords.get(locId);
			const speciesSet = hotspotAllTimeSpecies.get(locId);
			const speciesCount = speciesSet ? speciesSet.size : 0;

			// Only include relevant hotspots (e.g., > 10 species) to keep file size down
			if (speciesCount > 10) {
				allHotspots.push({
					id: locId,
					name: name,
					latitude: coords ? coords.lat : 0,
					longitude: coords ? coords.lng : 0,
					speciesCount: speciesCount
				});
			}
		}
		allHotspots.sort((a, b) => b.speciesCount - a.speciesCount);

		fs.writeFileSync(HOTSPOTS_OUTPUT_FILE, JSON.stringify(allHotspots, null, 2));
		console.log(
			`Success! Hotspots list written to ${HOTSPOTS_OUTPUT_FILE} (${allHotspots.length} locations)`
		);

		// 3. Region Stats (Replacement for fetchRegionStats)
		const stats = {
			totalSpecies: regionAllTimeSpecies.size,
			totalObservations: 0 // Not strictly needed for UI right now
		};
		fs.writeFileSync(STATS_OUTPUT_FILE, JSON.stringify(stats, null, 2));
		console.log(`Success! Stats written to ${STATS_OUTPUT_FILE}`);

		// 4. Species Locations (New)
		fs.writeFileSync(SPECIES_LOCATIONS_FILE, JSON.stringify(speciesLocations, null, 2));
		console.log(`Success! Species locations written to ${SPECIES_LOCATIONS_FILE}`);
	} catch (err) {
		console.error('Error processing data:', err);
	}
})();
