const stateFips = {
    'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06',
    'CO': '08', 'CT': '09', 'DE': '10', 'FL': '12', 'GA': '13',
    'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18', 'IA': '19',
    'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24',
    'MA': '25', 'MI': '26', 'MN': '27', 'MS': '28', 'MO': '29',
    'MT': '30', 'NE': '31', 'NV': '32', 'NH': '33', 'NJ': '34',
    'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38', 'OH': '39',
    'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45',
    'SD': '46', 'TN': '47', 'TX': '48', 'UT': '49', 'VT': '50',
    'VA': '51', 'WA': '53', 'WV': '54', 'WI': '55', 'WY': '56'
};

const stateNames = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
    CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
    MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
    NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
    OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
    VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
};

const stateDistricts = {
    AL: 7, AK: 1, AZ: 9, AR: 4, CA: 52, CO: 8, CT: 5, DE: 1, FL: 28, GA: 14,
    HI: 2, ID: 2, IL: 17, IN: 9, IA: 4, KS: 4, KY: 6, LA: 6, ME: 2, MD: 8,
    MA: 9, MI: 13, MN: 8, MS: 4, MO: 8, MT: 2, NE: 3, NV: 4, NH: 2, NJ: 12,
    NM: 3, NY: 26, NC: 14, ND: 1, OH: 15, OK: 5, OR: 6, PA: 17, RI: 2, SC: 7,
    SD: 1, TN: 9, TX: 38, UT: 4, VT: 1, VA: 11, WA: 10, WV: 2, WI: 8, WY: 1
};

const map = L.map('map', {
    center: [39.8283, -98.5795],
    zoom: 4,
    minZoom: 3,
    maxZoom: 12,
    zoomControl: false // Move to bottom right
});

L.control.zoom({
    position: 'bottomright'
}).addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

const repSearch = document.getElementById('repSearch');
const suggestions = document.getElementById('suggestions');
const infoPanel = document.getElementById('infoPanel');
const infoTitle = document.getElementById('infoTitle');
const infoSubtitle = document.getElementById('infoSubtitle');
const memberInfo = document.getElementById('memberInfo');
const closePanel = document.getElementById('closePanel');

let currentLayer = null;
let legislatorsCache = [];
let searchIndex = [];

async function loadStateBorders() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json');
        if (response.ok) {
            const data = await response.json();
            L.geoJSON(data, {
                style: {
                    fillColor: '#e2e8f0',
                    fillOpacity: 0.1,
                    color: '#94a3b8',
                    weight: 1,
                    dashArray: '3'
                },
                interactive: false
            }).addTo(map);
        }
    } catch (error) {
        console.error('Error loading state borders:', error);
    }
}

async function loadData() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/unitedstates/congress-legislators/gh-pages/legislators-current.json');
        if (!response.ok) throw new Error('Failed to load legislators');
        const data = await response.json();
        const now = new Date().toISOString().split('T')[0];
        
        legislatorsCache = data.map(leg => {
            const currentTerm = leg.terms?.find(t => t.start <= now && t.end >= now) || leg.terms?.[leg.terms.length - 1];
            const isSenator = currentTerm?.type === 'sen';
            return {
                name: leg.name?.full_name || `${leg.name?.first} ${leg.name?.last}`,
                state: currentTerm?.state,
                district: isSenator ? null : currentTerm?.district,
                party: currentTerm?.party === 'Democrat' ? 'D' : currentTerm?.party === 'Republican' ? 'R' : 'I',
                chamber: isSenator ? 'senator' : 'rep',
                bioguide: leg.id?.bioguide
            };
        }).filter(leg => leg.state);
        
        buildSearchIndex();
    } catch (error) {
        console.error('Error loading legislators:', error);
    }
}

function buildSearchIndex() {
    searchIndex = [];
    
    // Add districts
    for (const [state, numDistricts] of Object.entries(stateDistricts)) {
        if (numDistricts === 1) {
            searchIndex.push({
                type: 'district',
                text: `${state}-AL ${state} At-Large ${stateNames[state]}`.toLowerCase(),
                state: state,
                district: 'AL',
                displayTitle: `${state}-AL`,
                displaySubtitle: `${stateNames[state]} At-Large`
            });
        } else {
            for (let i = 1; i <= numDistricts; i++) {
                const distStr = i.toString().padStart(2, '0');
                searchIndex.push({
                    type: 'district',
                    text: `${state}-${distStr} ${state}-${i} ${stateNames[state]} District ${i}`.toLowerCase(),
                    state: state,
                    district: i,
                    displayTitle: `${state}-${distStr}`,
                    displaySubtitle: `${stateNames[state]} District ${i}`
                });
            }
        }
    }

    // Add legislators
    legislatorsCache.forEach(leg => {
        const role = leg.chamber === 'senator' ? 'Senator' : 'Representative';
        const distInfo = leg.district ? `District ${leg.district}` : 'At-Large';
        const subtitle = leg.chamber === 'senator' 
            ? `${stateNames[leg.state]} Senator` 
            : `${stateNames[leg.state]} ${distInfo}`;
            
        const distStrSearch = leg.district ? `${leg.state}-${leg.district.toString().padStart(2, '0')}`.toLowerCase() : `${leg.state}-AL`.toLowerCase();

        searchIndex.push({
            type: 'member',
            text: `${leg.name} ${stateNames[leg.state]} ${leg.state} ${role} ${leg.district || ''} ${distStrSearch}`.toLowerCase(),
            state: leg.state,
            district: leg.district,
            chamber: leg.chamber,
            party: leg.party,
            displayTitle: leg.name,
            displaySubtitle: subtitle
        });
    });
}

function handleSearchInput(e) {
    const query = e.target.value.trim().toLowerCase();
    if (query.length < 2) {
        suggestions.classList.remove('visible');
        return;
    }
    
    const matches = searchIndex.filter(item => item.text.includes(query)).slice(0, 8);
    showSuggestions(matches);
}

function showSuggestions(matches) {
    if (matches.length === 0) {
        suggestions.classList.remove('visible');
        return;
    }
    
    suggestions.innerHTML = matches.map((item, index) => {
        let icon = item.type === 'district' ? '🗺️' : '👤';
        let partyDot = '';
        if (item.party) {
            const partyClass = item.party === 'D' ? 'party-D' : item.party === 'R' ? 'party-R' : 'party-I';
            partyDot = `<span class="party-icon ${partyClass}"></span>`;
        }
        
        return `
            <div class="suggestion-item" data-index="${index}">
                <div class="suggestion-icon">${icon}</div>
                <div class="suggestion-content">
                    <div class="suggestion-title">
                        ${partyDot} ${item.displayTitle}
                    </div>
                    <div class="suggestion-subtitle">${item.displaySubtitle}</div>
                </div>
            </div>
        `;
    }).join('');
    
    suggestions.classList.add('visible');
    
    // Add click handlers
    document.querySelectorAll('.suggestion-item').forEach(el => {
        el.addEventListener('click', (e) => {
            const index = e.currentTarget.dataset.index;
            const item = matches[index];
            repSearch.value = item.displayTitle;
            suggestions.classList.remove('visible');
            handleSelection(item);
        });
    });
}

async function fetchDistrictGeoJSON(stateAbbr, districtNumber) {
    const fips = stateFips[stateAbbr];
    if (!fips) return null;
    
    const isAtLarge = districtNumber === 'AL' || districtNumber === 0;
    const cdStr = isAtLarge ? '00' : districtNumber.toString().padStart(2, '0');
    
    const url = `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/0/query?where=STATE='${fips}'+AND+CD119='${cdStr}'&outFields=*&f=geojson`;
    
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('API failed');
        const data = await res.json();
        return data.features && data.features.length > 0 ? data : null;
    } catch (e) {
        console.error('Error fetching district shapes:', e);
        return null;
    }
}

async function fetchStateGeoJSON(stateAbbr) {
    const fips = stateFips[stateAbbr];
    if (!fips) return null;
    
    const url = `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0/query?where=STATE='${fips}'&outFields=*&f=geojson`;
    
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('API failed');
        const data = await res.json();
        return data.features && data.features.length > 0 ? data : null;
    } catch (e) {
        console.error('Error fetching state shapes:', e);
        return null;
    }
}

async function handleSelection(item) {
    if (currentLayer) {
        map.removeLayer(currentLayer);
        currentLayer = null;
    }
    
    if (item.chamber === 'senator') {
        const geojson = await fetchStateGeoJSON(item.state);
        if (geojson) {
            currentLayer = L.geoJSON(geojson, {
                style: {
                    fillColor: '#3b82f6',
                    fillOpacity: 0.2,
                    color: '#1e40af',
                    weight: 2
                }
            }).addTo(map);
            
            map.fitBounds(currentLayer.getBounds(), { padding: [50, 50], maxZoom: 7 });
        } else {
            map.setView([39.8283, -98.5795], 4);
        }
        
        showInfoPanel(item.state, null);
        return;
    }
    
    const targetDistrict = (item.district === 0 || item.district === 'AL') ? 'AL' : item.district;
    
    const geojson = await fetchDistrictGeoJSON(item.state, targetDistrict);
    if (geojson) {
        currentLayer = L.geoJSON(geojson, {
            style: {
                fillColor: '#3b82f6',
                fillOpacity: 0.2,
                color: '#1e40af',
                weight: 2
            }
        }).addTo(map);
        
        map.fitBounds(currentLayer.getBounds(), { padding: [50, 50], maxZoom: 9 });
    }
    
    showInfoPanel(item.state, targetDistrict);
}

async function fetchWikipediaSummary(title) {
    try {
        const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
        if (!response.ok) return null;
        const data = await response.json();
        return {
            extract: data.extract,
            thumbnail: data.thumbnail?.source || null
        };
    } catch (e) {
        console.error('Wiki fetch error:', e);
        return null;
    }
}

function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

async function showInfoPanel(state, district) {
    let members = [];
    if (district === null) {
        members = legislatorsCache.filter(leg => leg.state === state && leg.chamber === 'senator');
        infoTitle.textContent = 'Senators';
        infoSubtitle.textContent = stateNames[state];
    } else {
        members = legislatorsCache.filter(leg => leg.state === state && (leg.district == district || (district === 'AL' && leg.district === 0)));
        const distDisplay = district === 'AL' ? 'At-Large' : `District ${district}`;
        infoTitle.textContent = `${state}-${district === 'AL' ? 'AL' : district.toString().padStart(2, '0')}`;
        infoSubtitle.textContent = `${stateNames[state]} • ${distDisplay}`;
    }
    
    // Show loading state initially
    if (members.length > 0) {
        memberInfo.innerHTML = members.map(member => {
            const partyClass = member.party === 'D' ? 'party-D' : member.party === 'R' ? 'party-R' : 'party-I';
            const partyFull = member.party === 'D' ? 'Democrat' : member.party === 'R' ? 'Republican' : 'Independent';
            const id = `member-${member.bioguide || member.name.replace(/\s+/g, '')}`;
            
            return `
                <div class="member-card" id="${id}">
                    <div class="member-header">
                        <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cbd5e1'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E" class="member-photo" alt="Photo" />
                        <div>
                            <div class="member-name">
                                <span class="party-icon ${partyClass}"></span>
                                ${member.name}
                            </div>
                            <div class="member-details">
                                ${partyFull}<br>
                                ${member.chamber === 'senator' ? 'U.S. Senator' : 'U.S. Representative'}
                            </div>
                        </div>
                    </div>
                    <div class="member-summary loading-text">Loading Wikipedia summary...</div>
                </div>
            `;
        }).join('');
        
        // Add district summary placeholder if it's a rep
        if (district !== null) {
             memberInfo.innerHTML += `
                <div class="district-summary" id="district-summary-${state}-${district}">
                    <span class="loading-text">Loading district information...</span>
                </div>
            `;
        }
        
        infoPanel.classList.add('visible');
        
        // Fetch wikipedia info concurrently
        members.forEach(async member => {
            // Usually Wikipedia articles for reps are just their name
            const wikiTitle = member.name.replace(/\s+\(.*?\)/g, ''); // remove any nicknames in parens
            const summary = await fetchWikipediaSummary(wikiTitle);
            
            const id = `member-${member.bioguide || member.name.replace(/\s+/g, '')}`;
            const card = document.getElementById(id);
            if (card && summary) {
                if (summary.thumbnail) {
                    card.querySelector('.member-photo').src = summary.thumbnail;
                }
                card.querySelector('.member-summary').innerHTML = summary.extract || 'No Wikipedia summary available.';
                card.querySelector('.member-summary').classList.remove('loading-text');
            } else if (card) {
                card.querySelector('.member-summary').innerHTML = 'No Wikipedia summary available.';
                card.querySelector('.member-summary').classList.remove('loading-text');
            }
        });

        // Fetch district summary
        // Fetch district summary
        if (district !== null) {
            let districtWikiTitle;
            if (district === 'AL' || district === 0 || district === '0') {
                 districtWikiTitle = `${stateNames[state]}'s_at-large_congressional_district`;
            } else {
                 districtWikiTitle = `${stateNames[state]}'s_${getOrdinal(parseInt(district))}_congressional_district`;
            }
            const distSummary = await fetchWikipediaSummary(districtWikiTitle);
            const distContainer = document.getElementById(`district-summary-${state}-${district}`);
            if (distContainer && distSummary && distSummary.extract) {
                distContainer.innerHTML = `<strong>About the district:</strong><br>${distSummary.extract}`;
            } else if (distContainer) {
                distContainer.innerHTML = '<em>No district summary available.</em>';
            }
        }
        
    } else {
        memberInfo.innerHTML = `<div class="no-data">No representative found</div>`;
        infoPanel.classList.add('visible');
    }
}

function init() {
    loadStateBorders();
    loadData();
    
    repSearch.addEventListener('input', handleSearchInput);
    
    repSearch.addEventListener('blur', () => {
        setTimeout(() => suggestions.classList.remove('visible'), 200);
    });
    
    repSearch.addEventListener('focus', () => {
        if (repSearch.value.length >= 2) {
            handleSearchInput({ target: repSearch });
        }
    });
    
    closePanel.addEventListener('click', () => {
        infoPanel.classList.remove('visible');
    });
}

init();