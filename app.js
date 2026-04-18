const states = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const map = L.map('map', {
    center: [39.8283, -98.5795],
    zoom: 4,
    minZoom: 3,
    maxZoom: 10
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

async function loadStateBorders() {
    try {
        const statesGeoJSON = {
            type: "FeatureCollection",
            features: []
        };
        
        for (const state of states) {
            try {
                const response = await fetch(
                    `https://raw.githubusercontent.com/unitedstates/districts/gh-pages/states/${state}/shape.geojson`
                );
                if (response.ok) {
                    const data = await response.json();
                    data.features.forEach(f => {
                        f.properties.abbreviation = state;
                    });
                    statesGeoJSON.features.push(...data.features);
                }
            } catch (e) {}
        }
        
        if (statesGeoJSON.features.length > 0) {
            L.geoJSON(statesGeoJSON, {
                style: {
                    fillColor: '#e2e8f0',
                    fillOpacity: 0.3,
                    color: '#718096',
                    weight: 1
                },
                onEachFeature: (feature, layer) => {
                    layer.on('click', () => {
                        const state = feature.properties.abbreviation;
                        if (state) {
                            stateSelect.value = state;
                            handleStateChange();
                        }
                    });
                }
            }).addTo(map);
        }
    } catch (error) {
        console.error('Error loading state borders:', error);
    }
}

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

const stateSelect = document.getElementById('stateSelect');
const districtSelect = document.getElementById('districtSelect');
const searchBtn = document.getElementById('searchBtn');
const infoPanel = document.getElementById('infoPanel');
const memberInfo = document.getElementById('memberInfo');
const closePanel = document.getElementById('closePanel');
const repSearch = document.getElementById('repSearch');
const suggestions = document.getElementById('suggestions');

let currentLayer = null;
let currentDistrict = null;
let legislatorsCache = null;

function init() {
    loadStateBorders();
    
    states.forEach(state => {
        const option = document.createElement('option');
        option.value = state;
        option.textContent = stateNames[state];
        stateSelect.appendChild(option);
    });

    stateSelect.addEventListener('change', handleStateChange);
    searchBtn.addEventListener('click', searchDistrict);
    closePanel.addEventListener('click', () => infoPanel.classList.remove('visible'));
    repSearch.addEventListener('input', handleSearchInput);
    suggestions.addEventListener('click', handleSuggestionClick);
    repSearch.addEventListener('blur', () => setTimeout(() => suggestions.classList.remove('visible'), 200));
}

function handleStateChange() {
    districtSelect.innerHTML = '<option value="">Select District</option>';
    if (stateSelect.value) {
        districtSelect.disabled = false;
        
        const atLargeStates = ['AK', 'DE', 'ND', 'VT', 'WY', 'SD'];
        const twoDistrictStates = ['NH', 'RI'];
        
        if (atLargeStates.includes(stateSelect.value)) {
            const option = document.createElement('option');
            option.value = '1';
            option.textContent = 'At-Large';
            districtSelect.appendChild(option);
        } else {
            const numDistricts = stateSelect.value === 'TX' ? 38 : 
                                  stateSelect.value === 'CA' ? 52 : 
                                  stateSelect.value === 'FL' ? 28 : 
                                  stateSelect.value === 'NY' ? 26 : 
                                  stateSelect.value === 'PA' ? 17 : 
                                  stateSelect.value === 'IL' ? 17 : 
                                  stateSelect.value === 'OH' ? 15 : 10;
            for (let i = 1; i <= numDistricts; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `District ${i}`;
                districtSelect.appendChild(option);
            }
        }
    } else {
        districtSelect.disabled = true;
    }
}

async function loadLegislators() {
    if (legislatorsCache) return legislatorsCache;
    try {
        const response = await fetch(
            'https://raw.githubusercontent.com/unitedstates/congress-legislators/gh-pages/legislators-current.json'
        );
        if (!response.ok) throw new Error('Failed to load legislators');
        const data = await response.json();
        const now = new Date().toISOString().split('T')[0];
        
        legislatorsCache = data.map(leg => {
            const currentTerm = leg.terms?.find(t => t.start <= now && t.end >= now) || leg.terms?.[leg.terms.length - 1];
            const isSenator = currentTerm?.type === 'sen';
            return {
                name: leg.name?.full_name || `${leg.name?.last}, ${leg.name?.first}`,
                state: currentTerm?.state,
                district: isSenator ? null : currentTerm?.district,
                party: currentTerm?.party === 'Democrat' ? 'D' : currentTerm?.party === 'Republican' ? 'R' : 'I',
                chamber: isSenator ? 'senator' : 'rep',
                bioguide: leg.id?.bioguide
            };
        }).filter(leg => leg.state);
        
        return legislatorsCache;
    } catch (error) {
        console.error('Error loading legislators:', error);
        return [];
    }
}

function filterLegislators(query) {
    if (!legislatorsCache || query.length < 2) return [];
    const q = query.toLowerCase();
    return legislatorsCache
        .filter(leg => leg.name.toLowerCase().includes(q))
        .slice(0, 10);
}

function showSuggestions(matches) {
    if (matches.length === 0) {
        suggestions.classList.remove('visible');
        return;
    }
    suggestions.innerHTML = matches.map(leg => {
        const partyClass = leg.party === 'D' ? 'party-D' : leg.party === 'R' ? 'party-R' : 'party-I';
        const districtStr = leg.district ? ` - District ${leg.district}` : ' - Senate';
        return `
            <div class="suggestion-item" data-state="${leg.state}" data-district="${leg.district || ''}" data-chamber="${leg.chamber}">
                <span class="party-icon ${partyClass}"></span>
                <div>
                    <div class="suggestion-name">${leg.name}</div>
                    <div class="suggestion-details">${stateNames[leg.state] || leg.state}${districtStr}</div>
                </div>
            </div>
        `;
    }).join('');
    suggestions.classList.add('visible');
}

async function handleSearchInput(e) {
    const query = e.target.value.trim();
    if (query.length < 2) {
        suggestions.classList.remove('visible');
        return;
    }
    await loadLegislators();
    const matches = filterLegislators(query);
    showSuggestions(matches);
}

function handleSuggestionClick(e) {
    const item = e.target.closest('.suggestion-item');
    if (item) {
        const state = item.dataset.state;
        const district = item.dataset.district;
        repSearch.value = '';
        suggestions.classList.remove('visible');
        stateSelect.value = state;
        stateSelect.dispatchEvent(new Event('change'));
        if (district) districtSelect.value = district;
        searchDistrict();
    }
}

async function fetchDistrict(state, district) {
    try {
        const response = await fetch(
            `https://raw.githubusercontent.com/unitedstates/districts/gh-pages/states/${state}/shape.geojson`
        );
        if (!response.ok) throw new Error('District not found');
        return await response.json();
    } catch (error) {
        console.error('Error fetching district:', error);
        return null;
    }
}

async function searchDistrict() {
    const state = stateSelect.value;
    const district = districtSelect.value;

    if (!state) {
        alert('Please select a state');
        return;
    }

    if (currentLayer) map.removeLayer(currentLayer);

    if (district) {
        const geojson = await fetchDistrict(state, district);
        
        if (geojson) {
            currentDistrict = { state, district };
            
            currentLayer = L.geoJSON(geojson, {
                style: {
                    fillColor: '#2b6cb0',
                    fillOpacity: 0.3,
                    color: '#1a365d',
                    weight: 2
                }
            }).addTo(map);

            map.fitBounds(currentLayer.getBounds(), { padding: [50, 50] });
        } else {
            alert('District data not available. Try a different selection.');
        }
    } else {
        map.setView([39.8283, -98.5795], 4);
    }
    
    showMemberInfo(state, district || null);
}

async function showMemberInfo(state, district) {
    await loadLegislators();
    const members = legislatorsCache.filter(leg => 
        leg.state === state && 
        (district ? leg.district == district : leg.chamber === 'senator')
    );
    
    let html = `<h2>${stateNames[state]} - ${district ? `District ${district}` : 'Senate'}</h2>`;
    
    if (members.length > 0) {
        members.forEach(member => {
            const partyClass = member.party === 'D' ? 'party-D' : member.party === 'R' ? 'party-R' : 'party-I';
            const partyFull = member.party === 'D' ? 'Democrat' : member.party === 'R' ? 'Republican' : 'Independent';
            html += `
                <p style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0;">
                    <strong>${member.chamber === 'senator' ? 'Senator' : 'Representative'}:</strong> ${member.name}<br>
                    <strong>Party:</strong> <span class="party-icon ${partyClass}" style="display: inline-block; vertical-align: middle; margin-right: 4px;"></span>${partyFull}
                </p>
            `;
        });
    } else {
        html += `<p style="color: #718096; font-size: 0.75rem; margin-top: 0.5rem;">No member data found</p>`;
    }
    
    memberInfo.innerHTML = html;
    infoPanel.classList.add('visible');
}

init();